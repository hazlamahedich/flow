import { createServiceClient, updateRunStatus } from '@flow/db';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { executeConflictDetection } from '../calendar/detect-conflict-action.js';
import { executeProposeBooking } from '../calendar/propose-booking-action.js';
import { executeCreateEvent } from '../calendar/create-event-action.js';
import { writeAuditLog } from '../shared/audit-writer';
import type { ConflictDetectionInput } from '../calendar/detect-conflict-action.js';
import type { ProposeBookingInput } from '../calendar/propose-booking-action.js';
import type { CreateEventActionInput } from '../calendar/create-event-action.js';
import { AgentJobPayloadSchema } from './schemas.js';
import { handleDetectBypass, handleResolveCascade, registerCalendarScheduledJobs } from './calendar-bypass-worker.js';

const QUEUE_NAME = 'agent:calendar';

const ConflictJobInputSchema = z.object({
  eventId: z.string().min(1),
  clientCalendarId: z.string().min(1),
  workspace_id: z.string().uuid(),
});

const BookingProposalJobInputSchema = z.object({
  schedulingRequestId: z.string().uuid(),
  workspace_id: z.string().uuid(),
});

const CreateEventJobInputSchema = z.object({
  schedulingRequestId: z.string().uuid(),
  selectedOptionIndex: z.number().int().min(0),
  workspace_id: z.string().uuid(),
});

export { registerCalendarScheduledJobs };

export async function registerCalendarWorkers(boss: PgBoss): Promise<void> {
  await boss.work(QUEUE_NAME, async (jobs) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) return;
    const parsed = AgentJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      writeAuditLog({ workspaceId: 'unknown', agentId: 'calendar',
        action: 'worker.invalid_payload', entityType: 'agent_run', entityId: 'unknown',
        details: { error: parsed.error.message, outcome: 'skipped' } });
      return;
    }
    const { runId, workspaceId, actionType, input } = parsed.data;
    const supabase = createServiceClient();

    if (actionType === 'detectConflict') {
      await handleDetectConflict(runId, workspaceId, input, supabase);
    } else if (actionType === 'proposeBooking') {
      await handleProposeBooking(runId, workspaceId, input, supabase);
    } else if (actionType === 'createEvent') {
      await handleCreateEvent(runId, workspaceId, input, supabase);
    } else if (actionType === 'detectBypass') {
      await handleDetectBypass(runId, workspaceId, input, supabase);
    } else if (actionType === 'resolveCascade') {
      await handleResolveCascade(runId, workspaceId, input, supabase);
    } else {
      writeAuditLog({ workspaceId, agentId: 'calendar', action: 'worker.unknown_action',
        entityType: 'agent_run', entityId: runId,
        details: { actionType, outcome: 'skipped' } });
    }
  });
}

async function handleDetectConflict(
  runId: string, workspaceId: string, input: Record<string, unknown>, supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const inputParsed = ConflictJobInputSchema.safeParse(input);
  if (!inputParsed.success) {
    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'worker.invalid_input',
      entityType: 'agent_run', entityId: runId,
      details: { error: inputParsed.error.message, outcome: 'skipped' } });
    return;
  }

  const conflictInput: ConflictDetectionInput = {
    workspaceId, eventId: inputParsed.data.eventId,
    clientCalendarId: inputParsed.data.clientCalendarId,
  };

  try { await updateRunStatus(runId, 'running', { startedAt: new Date().toISOString() }); }
  catch { /* non-fatal */ }

  try {
    const result = await executeConflictDetection(runId, conflictInput, { supabase });
    try { await updateRunStatus(runId, 'completed', {
      completedAt: new Date().toISOString(),
      output: { conflictsFound: result.conflictsFound, conflictEventIds: result.conflictEventIds } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'detectConflict.complete',
      entityType: 'agent_run', entityId: runId,
      details: { conflictsFound: result.conflictsFound, conflictEventIds: result.conflictEventIds, outcome: 'completed' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Conflict detection failed';
    try { await updateRunStatus(runId, 'failed', {
      completedAt: new Date().toISOString(),
      error: { message } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'detectConflict.error',
      entityType: 'agent_run', entityId: runId,
      details: { error: message, outcome: 'failed' } });
    throw err;
  }
}

async function handleProposeBooking(
  runId: string, workspaceId: string, input: Record<string, unknown>, supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const inputParsed = BookingProposalJobInputSchema.safeParse(input);
  if (!inputParsed.success) {
    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'worker.invalid_input',
      entityType: 'agent_run', entityId: runId,
      details: { error: inputParsed.error.message, outcome: 'skipped' } });
    return;
  }

  const proposeInput: ProposeBookingInput = {
    workspaceId,
    schedulingRequestId: inputParsed.data.schedulingRequestId,
  };

  try { await updateRunStatus(runId, 'running', { startedAt: new Date().toISOString() }); }
  catch { /* non-fatal */ }

  try {
    const result = await executeProposeBooking(runId, proposeInput, { supabase });
    try { await updateRunStatus(runId, 'completed', {
      completedAt: new Date().toISOString(),
      output: { schedulingRequestId: result.schedulingRequestId, status: result.status } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'proposeBooking.complete',
      entityType: 'agent_run', entityId: runId,
      details: { schedulingRequestId: result.schedulingRequestId, status: result.status, outcome: 'completed' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Propose booking failed';
    try { await updateRunStatus(runId, 'failed', {
      completedAt: new Date().toISOString(),
      error: { message } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'proposeBooking.error',
      entityType: 'agent_run', entityId: runId,
      details: { error: message, outcome: 'failed' } });
    throw err;
  }
}

async function handleCreateEvent(
  runId: string, workspaceId: string, input: Record<string, unknown>, supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const inputParsed = CreateEventJobInputSchema.safeParse(input);
  if (!inputParsed.success) {
    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'worker.invalid_input',
      entityType: 'agent_run', entityId: runId,
      details: { error: inputParsed.error.message, outcome: 'skipped' } });
    return;
  }

  const createInput: CreateEventActionInput = {
    workspaceId,
    schedulingRequestId: inputParsed.data.schedulingRequestId,
    selectedOptionIndex: inputParsed.data.selectedOptionIndex,
  };

  try { await updateRunStatus(runId, 'running', { startedAt: new Date().toISOString() }); }
  catch { /* non-fatal */ }

  try {
    const result = await executeCreateEvent(runId, createInput, { supabase });
    const runStatus = result.status === 'booked' ? 'completed' as const : 'failed' as const;
    try { await updateRunStatus(runId, runStatus, {
      completedAt: new Date().toISOString(),
      output: { schedulingRequestId: result.schedulingRequestId, eventId: result.eventId, status: result.status } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: runStatus === 'completed' ? 'createEvent.complete' : 'createEvent.failed',
      entityType: 'agent_run', entityId: runId,
      details: { schedulingRequestId: result.schedulingRequestId, eventId: result.eventId, status: result.status, outcome: runStatus } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Create event failed';
    try { await updateRunStatus(runId, 'failed', {
      completedAt: new Date().toISOString(),
      error: { message } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'createEvent.error',
      entityType: 'agent_run', entityId: runId,
      details: { error: message, outcome: 'failed' } });
    throw err;
  }
}

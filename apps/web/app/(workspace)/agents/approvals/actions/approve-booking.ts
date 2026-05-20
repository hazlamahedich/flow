'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import { createFlowError, requireTenantContext } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServerAgentRunProducer } from '@/lib/agent-run-producer';

const approveBookingSchema = z.object({
  schedulingRequestId: z.string().uuid(),
  selectedOptionIndex: z.number().int().min(0),
});

export async function approveBooking(
  input: unknown,
): Promise<ActionResult<{ schedulingRequestId: string; status: string }>> {
  const parsed = approveBookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { schedulingRequestId, selectedOptionIndex } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { data: req, error: selectError } = await supabase
    .from('scheduling_requests')
    .select('id, status, proposed_options, workspace_id')
    .eq('id', schedulingRequestId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (selectError || !req) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Scheduling request not found', 'validation'),
    };
  }

  if (req.status !== 'options_proposed') {
    return {
      success: false,
      error: createFlowError(409, 'CONFLICT', `Request is in '${req.status}' status, expected options_proposed`, 'validation'),
    };
  }

  const proposedOptions = req.proposed_options as Record<string, unknown>[];
  if (!proposedOptions || selectedOptionIndex >= proposedOptions.length) {
    return {
      success: false,
      error: createFlowError(400, 'INVALID_OPTION', `Invalid option index: ${selectedOptionIndex}`, 'validation'),
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from('scheduling_requests')
    .update({
      selected_option: selectedOptionIndex,
      status: 'option_selected',
    })
    .eq('id', schedulingRequestId)
    .eq('status', 'options_proposed')
    .eq('workspace_id', ctx.workspaceId)
    .select('id, status')
    .maybeSingle();

  if (updateError || !updated) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update scheduling request', 'system'),
    };
  }

  try {
    const producer = await getServerAgentRunProducer();
    const windowBucket = Math.floor(Date.now() / (5 * 60 * 1000));
    await producer.submit({
      agentId: 'calendar',
      actionType: 'createEvent',
      input: {
        workspace_id: ctx.workspaceId,
        schedulingRequestId,
        selectedOptionIndex,
      },
      idempotencyKey: `create-event:${schedulingRequestId}:${windowBucket}`,
    });
  } catch {
    await supabase
      .from('scheduling_requests')
      .update({ status: 'options_proposed', selected_option: null })
      .eq('id', schedulingRequestId)
      .eq('workspace_id', ctx.workspaceId);
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to enqueue event creation', 'system'),
    };
  }

  return {
    success: true,
    data: { schedulingRequestId, status: 'option_selected' },
  };
}

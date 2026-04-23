import { describe, it, expect } from 'vitest';
import { agentRuns } from '../schema/agent-runs';
import { agentSignals } from '../schema/agent-signals';
import { agentRunStatusSchema, agentIdSchema } from '@flow/types';

describe('TC-10: agent_runs Drizzle schema matches migration columns', () => {
  const columns = Object.keys(agentRuns);

  it('has all required columns from migration', () => {
    const expected = [
      'id', 'workspaceId', 'agentId', 'jobId', 'signalId',
      'actionType', 'clientId', 'idempotencyKey', 'status',
      'input', 'output', 'error', 'trustTierAtExecution',
      'correlationId', 'startedAt', 'completedAt', 'createdAt', 'updatedAt',
    ];
    for (const col of expected) {
      expect(columns).toContain(col);
    }
  });
});

describe('TC-11: agent_signals Drizzle schema matches migration columns', () => {
  const columns = Object.keys(agentSignals);

  it('has all required columns from migration', () => {
    const expected = [
      'id', 'correlationId', 'causationId', 'agentId',
      'signalType', 'version', 'payload', 'targetAgent',
      'clientId', 'workspaceId', 'createdAt',
    ];
    for (const col of expected) {
      expect(columns).toContain(col);
    }
  });
});

describe('TC-12: DB ENUM matches TypeScript union type', () => {
  it('agent_run_status values match AgentRunStatus union', () => {
    const validStatuses = agentRunStatusSchema.options;
    const expected: readonly string[] = [
      'queued', 'running', 'waiting_approval',
      'completed', 'failed', 'timed_out', 'cancelled',
    ];
    expect(validStatuses).toEqual(expected);
  });

  it('agent_id_type values match AgentId union', () => {
    const validAgentIds = agentIdSchema.options;
    const expected: readonly string[] = [
      'inbox', 'calendar', 'ar-collection',
      'weekly-report', 'client-health', 'time-integrity',
    ];
    expect(validAgentIds).toEqual(expected);
  });
});

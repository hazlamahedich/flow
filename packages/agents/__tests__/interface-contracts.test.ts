import { describe, it, expect } from 'vitest';
import type { AgentRunProducer, AgentRunWorker } from '../orchestrator/types';
import type { FlowError } from '@flow/types';
import { agentProposalSchema } from '@flow/types';

describe('TC-13: AgentRunProducer mock compilation', () => {
  it('satisfies interface contract with all required methods', () => {
    const producer: AgentRunProducer = {
      async submit() { return { runId: 'test', status: 'queued' }; },
      async cancel() {},
      async getStatus() { return 'queued'; },
      async listRuns() { return []; },
    };
    expect(typeof producer.submit).toBe('function');
    expect(typeof producer.cancel).toBe('function');
    expect(typeof producer.getStatus).toBe('function');
    expect(typeof producer.listRuns).toBe('function');
  });
});

describe('TC-14: AgentRunWorker mock compilation', () => {
  it('satisfies interface contract with all required methods', () => {
    const worker: AgentRunWorker = {
      async claim() { return null; },
      async complete() {},
      async fail() {},
      async propose() {},
    };
    expect(typeof worker.claim).toBe('function');
    expect(typeof worker.complete).toBe('function');
    expect(typeof worker.fail).toBe('function');
    expect(typeof worker.propose).toBe('function');
  });
});

describe('TC-15: FlowError exhaustiveness and AgentProposal validation', () => {
  it('agent error variants carry agentType', () => {
    const agentError: FlowError = {
      status: 500,
      code: 'AGENT_ERROR',
      message: 'Agent failed',
      category: 'agent',
      agentType: 'inbox',
      retryable: true,
    };
    expect(agentError.code).toBe('AGENT_ERROR');
    if ('agentType' in agentError) {
      expect(agentError.agentType).toBe('inbox');
    }
  });

  it('agent timeout variant carries agentType', () => {
    const timeoutError: FlowError = {
      status: 504,
      code: 'AGENT_TIMEOUT',
      message: 'Agent timed out',
      category: 'agent',
      agentType: 'calendar',
    };
    expect(timeoutError.code).toBe('AGENT_TIMEOUT');
  });

  it('AgentProposal Zod validation accepts valid proposals', () => {
    const valid = {
      title: 'Categorize email',
      confidence: 0.95,
      riskLevel: 'low' as const,
      reasoning: 'High confidence categorization',
    };
    expect(agentProposalSchema.parse(valid)).toEqual(valid);
  });

  it('AgentProposal Zod validation rejects invalid proposals', () => {
    expect(() => agentProposalSchema.parse({
      title: '',
      confidence: 1.5,
      riskLevel: 'extreme',
      reasoning: '',
    })).toThrow();
  });
});

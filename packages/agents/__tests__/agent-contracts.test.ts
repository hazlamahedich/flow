import { describe, it, expect } from 'vitest';
import { inboxInputSchema, inboxProposalSchema } from '../inbox/schemas';
import { calendarInputSchema, calendarProposalSchema } from '../calendar/schemas';
import { arCollectionInputSchema, arCollectionProposalSchema } from '../ar-collection/schemas';
import { weeklyReportInputSchema, weeklyReportProposalSchema } from '../weekly-report/schemas';
import { clientHealthInputSchema, clientHealthProposalSchema } from '../client-health/schemas';
import { timeIntegrityInputSchema, timeIntegrityProposalSchema } from '../time-integrity/schemas';
import { writeAuditLog } from '../shared/audit-writer';
import { getTrustTier } from '../shared/trust-client';
import { tokenizePII, detokenizePII } from '../shared/pii-tokenizer';
import { createLLMRouter } from '../shared/llm-router';
import { CircuitBreaker } from '../shared/circuit-breaker';

describe('TC-18: Agent module schemas exist with expected exports', () => {
  const schemas = [
    { name: 'inbox', input: inboxInputSchema, proposal: inboxProposalSchema },
    { name: 'calendar', input: calendarInputSchema, proposal: calendarProposalSchema },
    { name: 'ar-collection', input: arCollectionInputSchema, proposal: arCollectionProposalSchema },
    { name: 'weekly-report', input: weeklyReportInputSchema, proposal: weeklyReportProposalSchema },
    { name: 'client-health', input: clientHealthInputSchema, proposal: clientHealthProposalSchema },
    { name: 'time-integrity', input: timeIntegrityInputSchema, proposal: timeIntegrityProposalSchema },
  ];

  it.each(schemas)('$name has valid input and proposal schemas', ({ input, proposal }) => {
    expect(input).toBeDefined();
    expect(proposal).toBeDefined();
    expect(typeof input.parse).toBe('function');
    expect(typeof proposal.parse).toBe('function');
  });
});

describe('TC-19: Shared utility stubs exist with expected exports', () => {
  it('audit-writer exports writeAuditLog function', () => {
    expect(typeof writeAuditLog).toBe('function');
  });

  it('trust-client exports getTrustTier function', () => {
    expect(typeof getTrustTier).toBe('function');
  });

  it('pii-tokenizer exports tokenizePII and detokenizePII functions', () => {
    expect(typeof tokenizePII).toBe('function');
    expect(typeof detokenizePII).toBe('function');
  });

  it('llm-router exports createLLMRouter function', () => {
    expect(typeof createLLMRouter).toBe('function');
    const router = createLLMRouter();
    expect(typeof router.complete).toBe('function');
    expect(typeof router.isHealthy).toBe('function');
  });

  it('circuit-breaker exports CircuitBreaker class', () => {
    const breaker = new CircuitBreaker();
    expect(typeof breaker.recordSuccess).toBe('function');
    expect(typeof breaker.recordFailure).toBe('function');
    expect(breaker.state.isOpen).toBe(false);
  });
});

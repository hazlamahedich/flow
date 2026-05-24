import { describe, it, expect } from 'vitest';
import {
  calendarInputSchema,
  calendarProposalSchema,
  SchedulingRequestSchema,
  BookingProposalInputSchema,
  CreateEventInputSchema,
  SlotFindingInputSchema,
} from '../schemas';

describe('calendarInputSchema', () => {
  it('validates valid input', () => {
    const result = calendarInputSchema.safeParse({
      workspaceId: '550e8400-e29b-41d4-a716-446655440000',
      signalId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID workspaceId', () => {
    const result = calendarInputSchema.safeParse({
      workspaceId: 'not-a-uuid',
      signalId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = calendarInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('calendarProposalSchema', () => {
  it('validates valid proposal', () => {
    const result = calendarProposalSchema.safeParse({
      eventType: 'meeting',
      confidence: 0.85,
      reasoning: 'Matches pattern',
    });
    expect(result.success).toBe(true);
  });

  it('rejects confidence above 1', () => {
    const result = calendarProposalSchema.safeParse({
      eventType: 'meeting',
      confidence: 1.5,
      reasoning: 'Too high',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative confidence', () => {
    const result = calendarProposalSchema.safeParse({
      eventType: 'meeting',
      confidence: -0.1,
      reasoning: 'Negative',
    });
    expect(result.success).toBe(false);
  });
});

describe('SchedulingRequestSchema', () => {
  const validBase = {
    workspaceId: '550e8400-e29b-41d4-a716-446655440000',
    clientId: '550e8400-e29b-41d4-a716-446655440001',
    sourceType: 'email_extraction',
    requestType: 'book_new',
    requestedBy: { email: 'test@example.com' },
  };

  it('validates valid request', () => {
    const result = SchedulingRequestSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('validates all source types', () => {
    for (const sourceType of ['email_extraction', 'va_manual', 'client_portal']) {
      const result = SchedulingRequestSchema.safeParse({ ...validBase, sourceType });
      expect(result.success).toBe(true);
    }
  });

  it('validates all request types', () => {
    for (const requestType of ['book_new', 'reschedule', 'cancel', 'check_availability']) {
      const result = SchedulingRequestSchema.safeParse({ ...validBase, requestType });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid sourceType', () => {
    const result = SchedulingRequestSchema.safeParse({ ...validBase, sourceType: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('defaults preferences to empty object', () => {
    const result = SchedulingRequestSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preferences).toEqual({});
    }
  });

  it('accepts nullable sourceEmailId', () => {
    const result = SchedulingRequestSchema.safeParse({ ...validBase, sourceEmailId: null });
    expect(result.success).toBe(true);
  });
});

describe('BookingProposalInputSchema', () => {
  it('validates valid input', () => {
    const result = BookingProposalInputSchema.safeParse({
      workspaceId: '550e8400-e29b-41d4-a716-446655440000',
      schedulingRequestId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateEventInputSchema', () => {
  it('validates valid input', () => {
    const result = CreateEventInputSchema.safeParse({
      workspaceId: '550e8400-e29b-41d4-a716-446655440000',
      schedulingRequestId: '550e8400-e29b-41d4-a716-446655440001',
      selectedOptionIndex: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative selectedOptionIndex', () => {
    const result = CreateEventInputSchema.safeParse({
      workspaceId: '550e8400-e29b-41d4-a716-446655440000',
      schedulingRequestId: '550e8400-e29b-41d4-a716-446655440001',
      selectedOptionIndex: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('SlotFindingInputSchema', () => {
  const validBase = {
    workspaceId: '550e8400-e29b-41d4-a716-446655440000',
    clientId: '550e8400-e29b-41d4-a716-446655440001',
    durationMinutes: 30,
  };

  it('validates valid input', () => {
    const result = SlotFindingInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects zero durationMinutes', () => {
    const result = SlotFindingInputSchema.safeParse({ ...validBase, durationMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts preferredWindow', () => {
    const result = SlotFindingInputSchema.safeParse({
      ...validBase,
      preferredWindow: { start: '2026-06-01T09:00:00Z', end: '2026-06-01T17:00:00Z' },
    });
    expect(result.success).toBe(true);
  });

  it('defaults preferences to empty object', () => {
    const result = SlotFindingInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preferences).toEqual({});
    }
  });
});

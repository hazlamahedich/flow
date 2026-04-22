import { describe, it, expect } from 'vitest';

import { createClientSchema } from '../../app/(onboarding)/onboarding/_actions/create-client';
import { logTimeEntrySchema } from '../../app/(onboarding)/onboarding/_actions/log-time-entry';

describe('createClientSchema', () => {
  it('validates required name', () => {
    const result = createClientSchema.safeParse({ name: '', email: '', phone: '' });
    expect(result.success).toBe(false);
  });

  it('accepts valid input with name only', () => {
    const result = createClientSchema.safeParse({ name: 'Acme Corp' });
    expect(result.success).toBe(true);
  });

  it('accepts all fields', () => {
    const result = createClientSchema.safeParse({
      name: 'Acme Corp',
      email: 'info@acme.com',
      phone: '+1234567890',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = createClientSchema.safeParse({
      name: 'Acme',
      email: 'not-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty optional fields', () => {
    const result = createClientSchema.safeParse({
      name: 'Test',
      email: '',
      phone: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('logTimeEntrySchema', () => {
  it('requires client_id, date, and duration_minutes', () => {
    const result = logTimeEntrySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts valid input', () => {
    const result = logTimeEntrySchema.safeParse({
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      date: '2026-04-22',
      duration_minutes: 60,
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero duration', () => {
    const result = logTimeEntrySchema.safeParse({
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      date: '2026-04-22',
      duration_minutes: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative duration', () => {
    const result = logTimeEntrySchema.safeParse({
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      date: '2026-04-22',
      duration_minutes: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer duration', () => {
    const result = logTimeEntrySchema.safeParse({
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      date: '2026-04-22',
      duration_minutes: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional description', () => {
    const result = logTimeEntrySchema.safeParse({
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      date: '2026-04-22',
      duration_minutes: 30,
      description: 'Coaching session',
    });
    expect(result.success).toBe(true);
  });
});

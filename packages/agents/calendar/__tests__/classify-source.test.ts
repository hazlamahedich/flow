import { describe, it, expect } from 'vitest';
import { classifyEventSource } from '../classify-source';

describe('classifyEventSource', () => {
  const vaEmail = 'va@agency.com';
  const calendars = [{ emailAddress: 'client@example.com' }];

  it('classifies va_created when organizer matches VA email', () => {
    const result = classifyEventSource(
      { organizerEmail: 'va@agency.com', title: 'Meeting', isRecurring: false },
      calendars,
      vaEmail,
    );
    expect(result).toBe('va_created');
  });

  it('classifies va_created when createdVia is flow_os', () => {
    const result = classifyEventSource(
      { title: 'Meeting', isRecurring: false, createdVia: 'flow_os' },
      calendars,
      vaEmail,
    );
    expect(result).toBe('va_created');
  });

  it('classifies va_created when createdVia starts with agent:', () => {
    const result = classifyEventSource(
      { title: 'Meeting', isRecurring: false, createdVia: 'agent:calendar' },
      calendars,
      vaEmail,
    );
    expect(result).toBe('va_created');
  });

  it('preserves existing non-unknown source', () => {
    const result = classifyEventSource(
      { title: 'Meeting', isRecurring: false, source: 'third_party' },
      calendars,
      vaEmail,
    );
    expect(result).toBe('third_party');
  });

  it('classifies third_party for Calendly organizer', () => {
    const result = classifyEventSource(
      { organizerEmail: 'user@calendly.com', title: 'Meeting', isRecurring: false },
      calendars,
      vaEmail,
    );
    expect(result).toBe('third_party');
  });

  it('classifies third_party for Zoom organizer', () => {
    const result = classifyEventSource(
      { organizerEmail: 'user@zoom.us', title: 'Meeting', isRecurring: false },
      calendars,
      vaEmail,
    );
    expect(result).toBe('third_party');
  });

  it('classifies client_created when organizer matches client calendar', () => {
    const result = classifyEventSource(
      { organizerEmail: 'client@example.com', title: 'Meeting', isRecurring: false },
      calendars,
      vaEmail,
    );
    expect(result).toBe('client_created');
  });

  it('classifies auto_generated for recurring holiday events', () => {
    const result = classifyEventSource(
      { title: 'Public Holiday', isRecurring: true },
      calendars,
      vaEmail,
    );
    expect(result).toBe('auto_generated');
  });

  it('classifies auto_generated for OOO events', () => {
    const result = classifyEventSource(
      { title: 'Out of Office', isRecurring: true },
      calendars,
      vaEmail,
    );
    expect(result).toBe('auto_generated');
  });

  it('returns client_created for unrecognized organizer', () => {
    const result = classifyEventSource(
      { organizerEmail: 'someone@random.com', title: 'Meeting', isRecurring: false },
      calendars,
      vaEmail,
    );
    expect(result).toBe('client_created');
  });

  it('returns client_created when no organizer email', () => {
    const result = classifyEventSource(
      { title: 'Meeting', isRecurring: false },
      [],
      vaEmail,
    );
    expect(result).toBe('client_created');
  });

  it('classifies auto_generated for vacation recurring events', () => {
    const result = classifyEventSource(
      { title: 'Vacation Day', isRecurring: true },
      calendars,
      vaEmail,
    );
    expect(result).toBe('auto_generated');
  });

  it('does not classify non-recurring holiday as auto_generated', () => {
    const result = classifyEventSource(
      { title: 'Holiday', isRecurring: false },
      calendars,
      vaEmail,
    );
    expect(result).toBe('client_created');
  });

  it('handles case-insensitive VA email matching', () => {
    const result = classifyEventSource(
      { organizerEmail: 'VA@Agency.com', title: 'Meeting', isRecurring: false },
      calendars,
      vaEmail,
    );
    expect(result).toBe('va_created');
  });

  it('classifies acuityscheduling.com as third_party', () => {
    const result = classifyEventSource(
      { organizerEmail: 'test@acuityscheduling.com', title: 'Booking', isRecurring: false },
      calendars,
      vaEmail,
    );
    expect(result).toBe('third_party');
  });
});

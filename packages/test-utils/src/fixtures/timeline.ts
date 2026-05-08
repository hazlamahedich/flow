import { TimelineEvent, EmailTimelineEntry, AgentRunTimelineEntry } from '@flow/types';

export function buildEmailTimelineEntry(overrides: Partial<EmailTimelineEntry> = {}): EmailTimelineEntry {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    receivedAt: overrides.receivedAt ?? new Date().toISOString(),
    subject: overrides.subject ?? `Test Email ${id.slice(0, 8)}`,
    fromAddress: overrides.fromAddress ?? 'test@example.com',
    category: overrides.category ?? null,
    requiresConfirmation: overrides.requiresConfirmation ?? false,
    processingState: overrides.processingState ?? null,
  };
}

export function buildAgentRunTimelineEntry(overrides: Partial<AgentRunTimelineEntry> = {}): AgentRunTimelineEntry {
  const id = overrides.id ?? crypto.randomUUID();
  const entry: AgentRunTimelineEntry = {
    id,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    agentId: overrides.agentId ?? 'inbox',
    actionType: overrides.actionType ?? 'Categorize',
    status: overrides.status ?? 'completed',
    clientId: overrides.clientId ?? crypto.randomUUID(),
  };

  if (overrides.proposal) {
    entry.proposal = overrides.proposal;
  }

  return entry;
}

export function buildMixedTimelineFixture(
  emailCount: number,
  agentRunCount: number,
  options: { baseDate: string; emailOffsetMs: number; agentRunOffsetMs: number }
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const base = new Date(options.baseDate).getTime();

  for (let i = 0; i < emailCount; i++) {
    const ts = new Date(base - i * options.emailOffsetMs).toISOString();
    events.push({
      kind: 'email',
      sortKey: ts,
      data: buildEmailTimelineEntry({ id: `email-${i}`, receivedAt: ts }),
    });
  }

  for (let i = 0; i < agentRunCount; i++) {
    const ts = new Date(base - i * options.agentRunOffsetMs).toISOString();
    events.push({
      kind: 'agent_run',
      sortKey: ts,
      data: buildAgentRunTimelineEntry({ id: `run-${i}`, createdAt: ts }),
    });
  }

  return events.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

/**
 * Creates an EmailTimelineEntry for UTC boundary tests.
 * `isoDateString` must be a fully-qualified ISO 8601 string (with UTC offset or 'Z').
 * The `tz` parameter is informational — it documents the timezone the caller used to
 * construct `isoDateString`, but conversion is the caller's responsibility.
 */
export function buildEmailAtTimezone(tz: string, isoDateString: string): EmailTimelineEntry {
  if (!isoDateString.includes('Z') && !isoDateString.match(/[+-]\d{2}:\d{2}$/)) {
    throw new Error(
      `buildEmailAtTimezone: isoDateString must include a UTC offset (got "${isoDateString}"). ` +
        `Pass a fully-qualified ISO string, e.g. "2026-01-01T05:00:00+05:00".`,
    );
  }
  return buildEmailTimelineEntry({ receivedAt: new Date(isoDateString).toISOString() });
}

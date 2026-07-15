import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConflictResult } from './conflict-detection.js';

/** Parameters for writing conflict signals. */
export interface WriteConflictSignalsParams {
  supabase: SupabaseClient;
  workspaceId: string;
  clientId: string | null;
  conflicts: ConflictResult[];
  correlationId: string;
  causationId: string | null;
}

/** Signal row returned after batch insert. */
interface InsertedSignal {
  id: string;
}

/** Shape of a conflict_detected signal payload. */
interface ConflictSignalPayload {
  event1Id: string;
  event1Title: string;
  event2Id: string;
  event2Title: string;
  calendarId: string;
  overlapSeconds: number;
  detectedAt: string;
}

const CALENDAR_AGENT_ID = 'calendar' as const;

/**
 * Write an agent_signal record for each detected conflict.
 *
 * Uses a single batch insert. Returns the array of inserted signal IDs.
 * If the conflicts array is empty, returns an empty array immediately.
 */
export async function writeConflictSignals(
  params: WriteConflictSignalsParams,
): Promise<string[]> {
  const {
    supabase,
    workspaceId,
    clientId,
    conflicts,
    correlationId,
    causationId,
  } = params;

  if (conflicts.length === 0) {
    return [];
  }

  const detectedAt = new Date().toISOString();

  const signalRows = conflicts.map((conflict): Record<string, unknown> => {
    const payload: ConflictSignalPayload = {
      event1Id: conflict.event1.eventId,
      event1Title: conflict.event1.title,
      event2Id: conflict.event2.eventId,
      event2Title: conflict.event2.title,
      calendarId: conflict.event2.calendarId,
      overlapSeconds: conflict.overlapSeconds,
      detectedAt,
    };

    return {
      correlation_id: correlationId,
      causation_id: causationId,
      agent_id: CALENDAR_AGENT_ID,
      signal_type: 'calendar.conflict.detected',
      payload,
      target_agent: CALENDAR_AGENT_ID,
      client_id: clientId,
      workspace_id: workspaceId,
    };
  });

  // E-03 fix: deduplicate by event pair within this batch
  const seenPairs = new Set<string>();
  const dedupedRows = signalRows.filter((row) => {
    const payload = row.payload as ConflictSignalPayload;
    const pairKey = `${payload.event1Id}:${payload.event2Id}`;
    if (seenPairs.has(pairKey)) return false;
    seenPairs.add(pairKey);
    return true;
  });

  const { data, error } = await supabase
    .from('agent_signals')
    .insert(dedupedRows)
    .select('id');

  if (error) {
    throw Object.assign(
      new Error(`Failed to insert conflict signals: ${error.message}`),
      { code: 'SIGNAL_WRITE_FAILED' as const, statusCode: 500 },
    );
  }

  const inserted = (data ?? []) as unknown as InsertedSignal[];
  return inserted.map((row) => row.id);
}

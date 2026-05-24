import type { SupabaseClient } from '@supabase/supabase-js';

export interface WriteRelationParams {
  parentEventId: string;
  childEventId: string;
  relationType: 'prep_time' | 'travel_time' | 'debrief' | 'rescheduled_from';
  supabase: SupabaseClient;
}

export async function writeEventRelation(params: WriteRelationParams): Promise<void> {
  const { parentEventId, childEventId, relationType, supabase } = params;

  const { error } = await supabase
    .from('calendar_event_relations')
    .upsert(
      {
        parent_event_id: parentEventId,
        child_event_id: childEventId,
        relation_type: relationType,
      },
      { onConflict: 'parent_event_id,child_event_id,relation_type', ignoreDuplicates: true },
    );

  if (error) {
    throw Object.assign(
      new Error(`Failed to write event relation: ${error.message}`),
      { code: 'RELATION_WRITE_FAILED' as const, statusCode: 500 },
    );
  }
}

export async function writeRescheduledFromRelation(
  oldEventId: string,
  newEventId: string,
  supabase: SupabaseClient,
): Promise<void> {
  await writeEventRelation({
    parentEventId: oldEventId,
    childEventId: newEventId,
    relationType: 'rescheduled_from',
    supabase,
  });
}

export interface DependentEvent {
  id: string;
  parentEventId: string;
  childEventId: string;
  relationType: string;
}

export async function findDependentEvents(
  eventId: string,
  supabase: SupabaseClient,
): Promise<DependentEvent[]> {
  const { data, error } = await supabase
    .from('calendar_event_relations')
    .select('id, parent_event_id, child_event_id, relation_type')
    .or(`parent_event_id.eq.${eventId},child_event_id.eq.${eventId}`);

  if (error) {
    throw Object.assign(
      new Error(`Failed to query event relations: ${error.message}`),
      { code: 'RELATION_QUERY_FAILED' as const, statusCode: 500 },
    );
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    parentEventId: row.parent_event_id as string,
    childEventId: row.child_event_id as string,
    relationType: row.relation_type as string,
  }));
}

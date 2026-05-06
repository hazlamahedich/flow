import { createServiceClient } from '@flow/db';
import { ProcessingState, isValidTransition } from './schemas/processing';

export class InvalidStateTransitionError extends Error {
  constructor(
    public from: ProcessingState,
    public to: ProcessingState
  ) {
    super(`Invalid state transition from ${from} to ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export async function transitionState(
  emailId: string,
  workspaceId: string,
  toState: ProcessingState
): Promise<void> {
  const supabase = createServiceClient();

  // Use a transaction or careful sequence to prevent TOCTOU races
  // Note: supabase-js does not support SELECT FOR UPDATE directly.
  // We rely on the upsert conflict resolution and the fact that 
  // most transitions are single-worker per emailId.
  
  const { data: currentRecord, error: fetchError } = await supabase
    .from('email_processing_state')
    .select('state')
    .eq('email_id', emailId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const fromState = (currentRecord?.state as ProcessingState) || 'categorized';

  if (fromState !== toState && !isValidTransition(fromState, toState)) {
    throw new InvalidStateTransitionError(fromState, toState);
  }

  const { error: upsertError } = await supabase.from('email_processing_state').upsert(
    {
      email_id: emailId,
      workspace_id: workspaceId,
      state: toState,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'email_id, workspace_id',
    }
  );

  if (upsertError) throw upsertError;
}

export async function getProcessingState(
  emailId: string,
  workspaceId: string
): Promise<ProcessingState | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('email_processing_state')
    .select('state')
    .eq('email_id', emailId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) throw error;
  return (data?.state as ProcessingState) || null;
}

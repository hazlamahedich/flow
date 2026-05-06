import { createServiceClient } from '@flow/db';
import {
  createLLMRouter,
  tokenizePII,
  detokenizePII,
  ContextBoundary,
  AgentExecutionContext,
} from '../shared/index.js';
import { DraftJobPayload } from './schemas/draft';
import { transitionState, getProcessingState } from './state-machine';
import { loadVoiceContext, buildDraftPrompt } from './voice';
import { computeTrustLevel } from './trust';
import type { PgBoss } from 'pg-boss';

export async function draftWorker(job: { data: DraftJobPayload }, boss: PgBoss) {
  const { emailId, workspaceId, clientInboxId } = job.data;
  const supabase = createServiceClient();
  const llmRouter = createLLMRouter();

  try {
    await transitionState(emailId, workspaceId, 'draft_pending');

    // Load email content
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('subject, body_clean, client_id')
      .eq('id', emailId)
      .single();

    if (emailError || !email) throw new Error(`Email not found: ${emailId}`);

    // Load extracted actions
    const { data: actions, error: actionsError } = await supabase
      .from('extracted_actions')
      .select('action_type, description')
      .eq('email_id', emailId)
      .eq('soft_deleted', false);

    if (actionsError) throw actionsError;

    // Load voice context
    const voiceContext = await loadVoiceContext(workspaceId, email.client_id);

    // Compute trust for record-keeping
    const trustLevel = await computeTrustLevel(workspaceId, clientInboxId);

    const boundary = new ContextBoundary(email.client_id);

    // PII Tokenization for prompt safety
    const { text: tokenizedBody, tokens: bodyTokens } = tokenizePII(
      email.body_clean || '',
      workspaceId
    );
    const { text: tokenizedSubject, tokens: subjectTokens } = tokenizePII(
      email.subject || '',
      workspaceId
    );

    const prompt = buildDraftPrompt(
      voiceContext,
      tokenizedBody,
      tokenizedSubject,
      actions?.map((a) => ({ description: a.description, actionType: a.action_type })) || []
    );

    const wrappedPrompt = boundary.wrapContent(prompt, 'draft_request');

    const executionContext: AgentExecutionContext = {
      workspaceId,
      agentId: 'inbox',
      correlationId: emailId,
    };

    const response = await llmRouter.complete(
      [
        { role: 'system', content: 'You are an expert executive assistant drafting email replies.' },
        { role: 'user', content: wrappedPrompt },
      ],
      executionContext,
      { taskTier: 'quality', temperature: 0.7 }
    );

    // Detokenize the draft content (using union of tokens)
    const finalDraft = detokenizePII(response.text, [...bodyTokens, ...subjectTokens]);

    // Load voice profile ID for traceability
    const { data: profile } = await supabase
      .from('workspace_voice_profiles')
      .select('id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    // Persist draft
    const { error: insertError } = await supabase.from('draft_responses').insert({
      email_id: emailId,
      workspace_id: workspaceId,
      client_inbox_id: clientInboxId,
      draft_content: finalDraft,
      voice_profile_id: profile?.id ?? null,
      trust_at_generation: trustLevel,
      status: 'pending',
    });

    if (insertError) throw insertError;

    await transitionState(emailId, workspaceId, 'draft_complete');
  } catch (error) {
    console.error(`[inbox] Drafting failed for email ${emailId}:`, error);
    // On failure: transitions back to extraction_complete only if it was already draft_pending
    // This allows the pipeline to "degrade" gracefully to a state where the VA still has extraction results.
    try {
      const currentState = await getProcessingState(emailId, workspaceId);
      if (currentState === 'draft_pending') {
        await transitionState(emailId, workspaceId, 'extraction_complete');
      }
    } catch (stateErr) {
      console.error('[inbox] Failed to reset processing state after draft failure:', stateErr);
    }
    throw error;
  }
}

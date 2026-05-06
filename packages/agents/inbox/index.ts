export { execute, registerInboxPipelineWorkers } from './executor';
export { preCheck } from './pre-check';
export { inboxInputSchema, inboxProposalSchema, EMAIL_CATEGORIES, morningBriefOutputSchema } from './schemas';
export type { InboxInput, InboxProposal, InboxActionInput, EmailCategory, EmailProcessingInput, EmailCategorizationInput, MorningBriefProposal, HandledItem, NeedsAttentionItem, ThreadSummary, ClientBreakdown } from './schemas';
export { startHistoryWorker, handleDrainHistory } from './history-worker';
import { getMorningBriefContext } from './brief-context';
import { generateBrief } from './brief-generator';
import { saveMorningBrief } from '@flow/db';
import { scheduleDeferredDrafts, isFloodState } from './flood';

export async function generateMorningBrief(workspaceId: string) {
  const [context, flood] = await Promise.all([
    getMorningBriefContext(workspaceId),
    isFloodState(workspaceId),
  ]);
  const { brief, isFallback } = await generateBrief(context);

  const today = new Date().toISOString().split('T')[0];

  const result = await saveMorningBrief({
    workspace_id: workspaceId,
    brief_date: today,
    content: { ...brief, floodState: flood } as unknown as Record<string, unknown>,
    email_count_handled: brief.handledItems.length,
    email_count_attention: brief.needsAttentionItems.length,
    generation_status: isFallback ? 'failed' : 'completed',
    error_message: isFallback ? (brief.reassuranceMessage ?? 'LLM generation failed after retries') : null,
    flood_state: flood,
  });

  // Task: After brief delivery, trigger deferred drafts (AC10)
  const boss = await (globalThis as any).getBoss?.();
  if (boss) {
    await scheduleDeferredDrafts(workspaceId, boss).catch(err => {
      console.error(`[inbox] Failed to schedule deferred drafts for workspace ${workspaceId}:`, err);
    });
  }

  return result;
}

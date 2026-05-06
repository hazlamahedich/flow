import type { InboxProposal, InboxActionInput } from './schemas';
import { handleDrainHistory } from './history-worker';
import { categorizeEmail } from './categorizer';
import { generateMorningBrief } from './index';
import { insertSignal, updateEmailCategorization, createServiceClient } from '@flow/db';
import { transitionState } from './state-machine';
import { PgBossProducer } from '../orchestrator/pg-boss-producer.js';
import type { PgBoss } from 'pg-boss';
import { extractionWorker } from './extractor';
import { draftWorker } from './drafter';

export async function registerInboxPipelineWorkers(boss: PgBoss) {
  await boss.work('extract_actions', (job) => extractionWorker(job as any, boss));
  await boss.work('generate_draft', (job) => draftWorker(job as any, boss));
}

export async function execute(input: InboxActionInput): Promise<InboxProposal | void> {
  if (input.actionType === 'email_processing') {
    await handleDrainHistory({
      workspace_id: input.workspaceId,
      payloadId: input.payloadId,
      clientInboxId: input.clientInboxId,
    });
    return;
  }

  if (input.actionType === 'morning_brief_generation') {
    await generateMorningBrief(input.workspaceId);
    return;
  }

  if (input.actionType === 'email_categorization') {
    const startTime = Date.now();
    const supabase = createServiceClient();
    const { data: email, error } = await supabase
      .from('emails')
      .select('id, subject, body_clean, workspace_id, client_id, created_at')
      .eq('id', input.emailId)
      .single();

    if (error || !email) throw new Error(`Email not found: ${input.emailId}`);

    const proposal = await categorizeEmail({
      subject: email.subject,
      body_clean: email.body_clean,
      workspace_id: email.workspace_id,
      client_id: email.client_id,
      ...(input.runId ? { run_id: input.runId } : {}),
    });

    await updateEmailCategorization(supabase, email.id, {
      category: proposal.category,
      confidence: proposal.confidence,
      requires_confirmation: proposal.requires_confirmation,
      processedAt: new Date().toISOString(),
    });

    // Task 22: Post-categorization hook
    if (proposal.category === 'urgent' || proposal.category === 'action') {
      const { data: inbox } = await supabase
        .from('client_inboxes')
        .select('id')
        .eq('workspace_id', email.workspace_id)
        .eq('client_id', email.client_id)
        .single();

      if (inbox) {
        await transitionState(email.id, email.workspace_id, 'categorized');
        await transitionState(email.id, email.workspace_id, 'extraction_pending');

        const boss = await (globalThis as any).getBoss?.();
        if (boss) {
          const producer = new PgBossProducer(boss);
          await producer.submit({
            agentId: 'inbox',
            actionType: 'extract_actions',
            input: {
              workspaceId: email.workspace_id,
              emailId: email.id,
              clientInboxId: inbox.id,
            },
            idempotencyKey: `extract:${email.id}`,
            correlationId: email.id,
          });
        } else {
          // Log explicitly instead of silently skipping
          console.error(`[inbox] CRITICAL: PgBoss not available — extraction job NOT enqueued for email ${email.id}. Pipeline stalled at extraction_pending.`);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const totalLatencyMs = email.created_at
      ? Date.now() - new Date(email.created_at).getTime()
      : -1;
    console.log(`[inbox] Categorization completed in ${durationMs}ms (P95 target: 5000ms)`);
    if (totalLatencyMs >= 0) {
      console.log(`[inbox] Total pipeline latency: ${totalLatencyMs}ms (P95 target: 8000ms)`);
    }

    await insertSignal({
      workspaceId: email.workspace_id,
      agentId: 'inbox',
      signalType: 'email.received',
      correlationId: email.id,
      clientId: email.client_id,
      payload: {
        email_id: email.id,
        category: proposal.category,
        confidence: proposal.confidence,
        subject: email.subject,
        requires_confirmation: proposal.requires_confirmation,
        fallback: proposal.fallback ?? false,
      },
    });

    if (proposal.category === 'urgent' || proposal.requires_confirmation) {
      const signalType = proposal.category === 'urgent' ? 'email.client_urgent' : 'email.low_trust';
      await insertSignal({
        workspaceId: email.workspace_id,
        agentId: 'inbox',
        signalType,
        correlationId: email.id,
        clientId: email.client_id,
        payload: {
          email_id: email.id,
          reasoning: proposal.reasoning,
          category: proposal.category,
        },
      });
    }

    return proposal;
  }

  throw new Error('inbox.execute: unknown action type or not implemented');
}

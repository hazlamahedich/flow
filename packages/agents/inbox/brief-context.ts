import { createServiceClient } from '@flow/db';
import type { HandledItem, NeedsAttentionItem, ThreadSummary, ClientBreakdown } from './schemas';
import { ContextBoundary } from '../shared/context-boundary';

const MAX_EMAILS = 500;

interface EmailRow {
  id: string;
  subject: string | null;
  sender: string | null;
  thread_id: string | null;
  client_id: string;
  clients: Array<{ name: string }>;
  email_categorizations: Array<{ category: string | null; confidence: number | null }>;
}

export interface MorningBriefContext {
  workspaceId: string;
  since: Date;
  hasInboxes: boolean;
  hasEmails: boolean;
  clientBreakdown: ClientBreakdown[];
  handledItems: HandledItem[];
  needsAttentionItems: NeedsAttentionItem[];
  threadSummaries: ThreadSummary[];
  rawGroups: Array<{
    clientId: string;
    clientName: string;
    emails: Array<{ id: string; subject: string; sender: string; category?: string }>;
  }>;
}

export async function getMorningBriefContext(workspaceId: string, since?: Date): Promise<MorningBriefContext> {
  if (!workspaceId) throw new Error('workspaceId is required');

  const supabase = createServiceClient();

  let contextSince = since;
  if (!contextSince) {
    const { data: lastBrief, error: lastBriefError } = await supabase
      .from('morning_briefs')
      .select('generated_at')
      .eq('workspace_id', workspaceId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastBriefError) {
      console.error('Error fetching last brief, defaulting to 24h:', lastBriefError);
    }

    contextSince = lastBrief?.generated_at
      ? new Date(lastBrief.generated_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  const { data: emails, error: emailError } = await supabase
    .from('emails')
    .select(`
      id, subject, sender, thread_id, client_id,
      clients ( name ),
      email_categorizations ( category, confidence )
    `)
    .eq('workspace_id', workspaceId)
    .gte('created_at', contextSince.toISOString())
    .order('created_at', { ascending: false })
    .limit(MAX_EMAILS);

  if (emailError) throw emailError;

  const filteredEmails = (emails || []).filter((email: EmailRow) => email.client_id != null);

  const { data: clients } = await supabase
    .from('client_inboxes')
    .select('id')
    .eq('workspace_id', workspaceId)
    .limit(1);

  const hasInboxes = (clients || []).length > 0;
  const hasEmails = filteredEmails.length > 0;

  if (!hasEmails) {
    return {
      workspaceId,
      since: contextSince,
      hasInboxes,
      hasEmails: false,
      clientBreakdown: [],
      handledItems: [],
      needsAttentionItems: [],
      threadSummaries: [],
      rawGroups: [],
    };
  }

  const clientGroups = new Map<string, {
    name: string;
    emails: EmailRow[];
    handled: HandledItem[];
    needsAttention: NeedsAttentionItem[];
    uncategorized: EmailRow[];
    threads: Map<string, EmailRow[]>;
  }>();

  for (const email of filteredEmails) {
    const clientId: string = email.client_id;
    if (!clientGroups.has(clientId)) {
      const boundary = new ContextBoundary(clientId);
      boundary.assertClient(email.client_id);

      clientGroups.set(clientId, {
        name: email.clients?.[0]?.name || 'Unknown Client',
        emails: [],
        handled: [],
        needsAttention: [],
        uncategorized: [],
        threads: new Map(),
      });
    }
    const group = clientGroups.get(clientId)!;
    group.emails.push(email);

    const threadId = email.thread_id;
    if (threadId) {
      if (!group.threads.has(threadId)) {
        group.threads.set(threadId, []);
      }
      group.threads.get(threadId)!.push(email);
    }

    const cat = email.email_categorizations?.[0];
    if (cat?.category === 'info' || cat?.category === 'noise') {
      group.handled.push({
        emailId: email.id,
        subject: email.subject ?? '(no subject)',
        sender: email.sender ?? '(unknown)',
        actionTaken: cat.category === 'info' ? 'Categorized as info' : 'Categorized as noise',
        clientName: group.name,
      });
    } else if (cat?.category === 'urgent' || cat?.category === 'action') {
      group.needsAttention.push({
        emailId: email.id,
        subject: email.subject ?? '(no subject)',
        sender: email.sender ?? '(unknown)',
        category: cat.category as 'urgent' | 'action',
        reason: 'Identified as requiring attention',
        clientName: group.name,
      });
    } else {
      group.uncategorized.push(email);
    }
  }

  const clientBreakdown: ClientBreakdown[] = [];
  const allHandled: HandledItem[] = [];
  const allNeedsAttention: NeedsAttentionItem[] = [];
  const threadSummaries: ThreadSummary[] = [];

  for (const [clientId, group] of clientGroups.entries()) {
    const urgentCount = group.needsAttention.filter(i => i.category === 'urgent').length;
    const actionCount = group.needsAttention.filter(i => i.category === 'action').length;

    clientBreakdown.push({
      clientId,
      clientName: group.name,
      totalEmails: group.emails.length,
      urgentCount,
      actionCount,
      handledCount: group.handled.length,
    });

    allHandled.push(...group.handled);
    allNeedsAttention.push(...group.needsAttention);

    for (const [threadId, threadEmails] of group.threads.entries()) {
      if (threadEmails.length > 3) {
        threadSummaries.push({
          threadKey: threadId,
          emailCount: threadEmails.length,
          summary: '',
          clientName: group.name,
        });
      }
    }
  }

  return {
    workspaceId,
    since: contextSince,
    hasInboxes,
    hasEmails,
    clientBreakdown,
    handledItems: allHandled,
    needsAttentionItems: allNeedsAttention,
    threadSummaries,
    rawGroups: Array.from(clientGroups.entries()).map(([id, g]) => ({
      clientId: id,
      clientName: g.name,
      emails: g.emails.map(e => {
        const result: { id: string; subject: string; sender: string; category?: string } = {
          id: e.id,
          subject: e.subject ?? '',
          sender: e.sender ?? '',
        };
        const cat = e.email_categorizations?.[0]?.category;
        if (cat) result.category = cat;
        return result;
      }),
    })),
  };
}

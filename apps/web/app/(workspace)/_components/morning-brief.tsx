import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { morningBriefOutputSchema, type MorningBriefProposal } from '@flow/agents/inbox';
import { Badge, Button } from '@flow/ui';
import { MorningBriefTracker } from './morning-brief-tracker';
import { FloodStateBanner } from './flood-state-banner';
import { CollapsedEmailCluster } from './collapsed-email-cluster';

export async function MorningBrief() {
  const supabase = await getServerSupabase();
  const context = await requireTenantContext(supabase);
  const { workspaceId } = context;

  const { data: brief, error } = await supabase
    .from('morning_briefs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('brief_date', new Date().toISOString().split('T')[0])
    .maybeSingle();

  if (error) {
    console.error('Error fetching morning brief:', error);
    return null;
  }

  if (!brief) {
    const { data: inboxes } = await supabase
      .from('client_inboxes')
      .select('id')
      .eq('workspace_id', workspaceId)
      .limit(1);

    if (!inboxes || inboxes.length === 0) {
      return (
        <div className="p-6 border rounded-xl bg-muted/10 border-dashed mb-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Connect an inbox to get your first Morning Brief
          </p>
        </div>
      );
    }

    return null;
  }

  if (brief.generation_status === 'failed') {
    return (
      <div className="p-6 border border-destructive/50 rounded-xl bg-destructive/5 mb-6">
        <p className="text-sm font-medium text-destructive">
          Technical issue generating today&apos;s brief — retrying shortly.
        </p>
      </div>
    );
  }

  const rawContent = brief.content as Record<string, unknown>;
  const parsed = morningBriefOutputSchema.safeParse(rawContent);
  if (!parsed.success) {
    console.error('Brief content schema validation failed:', parsed.error);
    return (
      <div className="p-6 border border-destructive/50 rounded-xl bg-destructive/5 mb-6">
        <p className="text-sm font-medium text-destructive">
          Technical issue generating today&apos;s brief — retrying shortly.
        </p>
      </div>
    );
  }
  const content = parsed.data as MorningBriefProposal;
  const isUnread = !brief.viewed_at;
  const isFlood = brief.flood_state === true || content.floodState === true;

  return (
    <div className={`p-6 border rounded-xl bg-card shadow-sm mb-6 transition-colors ${isUnread ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
      {isUnread && <MorningBriefTracker briefId={brief.id} />}

      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-sm font-bold uppercase tracking-tight ${isUnread ? 'text-primary' : 'text-muted-foreground'}`}>
          Today&apos;s Morning Brief
        </h2>
        {isUnread && <Badge>New</Badge>}
      </div>

      <p className="text-2xl font-semibold mb-8 text-foreground leading-tight">
        {content.summaryLine}
      </p>

      {isFlood && <FloodStateBanner />}

      {content.handledItems.length > 0 && (
        isFlood ? (
          <CollapsedEmailCluster 
            title="Handled Overnight" 
            items={content.handledItems} 
            variant="handled" 
          />
        ) : (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--flow-color-gold)] to-transparent opacity-50" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--flow-color-gold)]">Handled Overnight</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--flow-color-gold)] to-transparent opacity-50" />
            </div>
            <div className="grid gap-2">
              {content.handledItems.map((item, idx) => (
                <div key={item.emailId ?? idx} className="group flex items-center justify-between p-3 rounded-lg bg-green-500/[0.03] border border-green-500/10 hover:bg-green-500/[0.05] transition-colors">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 opacity-50" />
                    <span className="font-bold text-green-800/70 dark:text-green-400/70">{item.clientName}:</span>
                    <span className="text-muted-foreground truncate max-w-[400px]">{item.subject}</span>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground/60 italic px-2 py-0.5 rounded-full bg-muted/50 group-hover:bg-muted transition-colors">
                    {item.actionTaken}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {content.needsAttentionItems.length > 0 && (
        isFlood ? (
          <CollapsedEmailCluster 
            title="Requires Your Attention" 
            items={content.needsAttentionItems} 
            variant="attention" 
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-destructive">Requires Your Attention</span>
            </div>
            {content.needsAttentionItems.map((item, idx) => (
              <form key={item.emailId ?? idx} className="flex items-start justify-between p-5 rounded-xl border border-destructive/20 bg-destructive/[0.02] hover:bg-destructive/[0.04] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={item.category === 'urgent' ? 'destructive' : 'outline'} className="text-[9px] h-4 px-1.5 font-black uppercase">
                      {item.category}
                    </Badge>
                    <span className="text-sm font-bold truncate">{item.sender}</span>
                    <span className="text-xs text-muted-foreground/60">— {item.clientName}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1 truncate">{item.subject}</p>
                  <p className="text-xs text-muted-foreground/80 line-clamp-1">{item.reason}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <input type="hidden" name="emailId" value={item.emailId} />
                  <button formAction={undefined} type="button" className="inline-flex items-center justify-center h-8 px-3 text-xs font-bold rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                    Open
                  </button>
                  <button formAction={undefined} type="button" className="inline-flex items-center justify-center h-8 px-3 text-xs font-bold rounded-md border border-input bg-background opacity-60 hover:opacity-100">
                    Dismiss
                  </button>
                </div>
              </form>
            ))}
          </div>
        )
      )}

      {content.threadSummaries.length > 0 && (
        <div className="mt-8 pt-6 border-t border-dashed">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-4">Deep Dive Summaries</h3>
          <div className="space-y-3">
            {content.threadSummaries.map((thread, idx) => (
              <div key={thread.threadKey ?? idx} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
                <span className="text-primary/40 font-bold shrink-0">{thread.emailCount}x</span>
                <p>
                  <span className="font-bold text-foreground/70">{thread.clientName}:</span> {thread.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.handledItems.length === 0 && content.needsAttentionItems.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-xl font-medium text-muted-foreground/80">
            {content.reassuranceMessage || 'All clear — your agents handled everything overnight'}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mt-4">
            Last checked {brief.generated_at ? new Date(brief.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'today'}
          </p>
        </div>
      )}
    </div>
  );
}

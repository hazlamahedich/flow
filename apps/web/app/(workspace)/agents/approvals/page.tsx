import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getPendingApprovals } from '@flow/db';
import type { Metadata } from 'next';
import { ApprovalQueue } from './components/approval-queue';
import { AGENT_LABELS, ACTION_LABELS } from './constants';

export const metadata: Metadata = { title: 'Agent Approvals' };
export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  const result = await getPendingApprovals(supabase, workspaceId, { limit: 50 });

  const agentParts = Object.entries(result.agentBreakdown)
    .filter(([, count]) => count > 0)
    .map(([agentId, count]) => {
      const label = AGENT_LABELS[agentId] ?? agentId;
      const action = ACTION_LABELS[agentId] ?? 'items';
      return `${label}: ${count} ${count === 1 ? action.replace(/s$/, '') : action}`;
    });

  const summaryText = agentParts.length > 0
    ? `${agentParts.join(', ')}. ${result.totalCount} item${result.totalCount === 1 ? '' : 's'} need${result.totalCount === 1 ? 's' : ''} your attention.`
    : 'All clear \u2014 your agents handled everything.';

  return (
    <div className="space-y-6">
      <a href="#approval-queue-start" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-[var(--flow-accent-primary)] focus:px-4 focus:py-2 focus:text-sm focus:text-[var(--flow-accent-primary-text)]">
        Skip to approval queue
      </a>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Approvals
        </h1>
        {result.totalCount > 0 && (
          <span className="inline-flex items-center rounded-[var(--flow-radius-full)] bg-[var(--flow-accent-primary)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--flow-accent-primary)]">
            {result.totalCount} pending
          </span>
        )}
      </div>

      <p className="text-sm text-[var(--flow-text-secondary)]">
        {summaryText}
      </p>

      <ApprovalQueue
        initialItems={result.items}
        agentBreakdown={result.agentBreakdown}
        totalCount={result.totalCount}
        trustStaleIds={result.trustStaleIds}
        workspaceId={workspaceId}
      />
    </div>
  );
}

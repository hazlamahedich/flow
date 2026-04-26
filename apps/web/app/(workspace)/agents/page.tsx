import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import type { Metadata } from 'next';
import { AgentTrustGrid } from './components/agent-trust-grid';
import { getTrustSummaryForWorkspace } from './lib/trust-summary';

export const metadata: Metadata = { title: 'Agents' };
export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  const trustSummary = await getTrustSummaryForWorkspace(workspaceId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
        Agents
      </h1>
      <AgentTrustGrid workspaceId={workspaceId} initialData={trustSummary} />
    </div>
  );
}

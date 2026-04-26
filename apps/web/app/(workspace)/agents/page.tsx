import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { getCheckInDue } from '@flow/db';
import { getCheckInSetting } from '@flow/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AgentTrustGrid } from './components/agent-trust-grid';
import { getTrustSummaryForWorkspace } from './lib/trust-summary';

export const metadata: Metadata = { title: 'Agents' };
export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  const trustSummary = await getTrustSummaryForWorkspace(workspaceId);
  const checkInEnabled = await getCheckInSetting(workspaceId);
  const checkInDue = checkInEnabled ? await getCheckInDue(workspaceId) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Agents
        </h1>
        <Link
          href="/agents/trust-history"
          className="text-sm text-[var(--flow-color-text-secondary)] hover:text-[var(--flow-color-text-primary)] underline-offset-4 hover:underline"
        >
          View trust history
        </Link>
      </div>
      <AgentTrustGrid
        workspaceId={workspaceId}
        initialData={trustSummary}
        checkInDue={checkInDue}
        checkInEnabled={checkInEnabled}
      />
    </div>
  );
}

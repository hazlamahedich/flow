import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { getUserAgentConfigurations } from '@flow/db';
import type { Metadata } from 'next';
import { AgentCard } from './components/agent-card';
import { AgentFirstRun } from './components/agent-first-run';
import type { AgentId } from '@flow/types';

export const metadata: Metadata = { title: 'Agents' };
export const dynamic = 'force-dynamic';

const AGENT_META: Record<AgentId, { label: string; description: string; icon: string }> = {
  inbox: { label: 'Inbox', description: 'Categorize and prioritize your emails automatically', icon: 'inbox' },
  calendar: { label: 'Calendar', description: 'Manage scheduling, conflicts, and availability', icon: 'calendar' },
  'ar-collection': { label: 'AR Collection', description: 'Track overdue invoices and send payment reminders', icon: 'ar' },
  'weekly-report': { label: 'Weekly Report', description: 'Generate summaries of workspace activity', icon: 'report' },
  'client-health': { label: 'Client Health', description: 'Monitor client engagement and retention signals', icon: 'health' },
  'time-integrity': { label: 'Time Integrity', description: 'Audit time entries and flag inconsistencies', icon: 'time' },
};

const RECOMMENDED_ORDER: AgentId[] = ['inbox', 'calendar', 'ar-collection', 'weekly-report', 'client-health', 'time-integrity'];

export default async function AgentsPage() {
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);
  const configurations = await getUserAgentConfigurations(supabase, workspaceId);

  const hasAnyActive = configurations.some((c) => {
    const status = (c as Record<string, unknown>).status as string;
    return status === 'active' || status === 'activating';
  });

  if (!hasAnyActive) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Agents
        </h1>
        <AgentFirstRun
          agents={RECOMMENDED_ORDER.map((id) => ({ id, ...AGENT_META[id] }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
        Agents
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RECOMMENDED_ORDER.map((agentId) => {
          const config = configurations.find((c) => (c as Record<string, unknown>).agent_id === agentId);
          const meta = AGENT_META[agentId];
          const row = config as Record<string, unknown> | undefined;
          const cardProps: {
            agentId: string;
            label: string;
            description: string;
            icon: string;
            status?: string;
            setupCompleted?: boolean;
            lifecycleVersion?: number;
          } = {
            agentId,
            label: meta.label,
            description: meta.description,
            icon: meta.icon,
          };
          if (row?.status !== undefined) cardProps.status = row.status as string;
          if (row?.setup_completed !== undefined) cardProps.setupCompleted = row.setup_completed as boolean;
          if (row?.lifecycle_version !== undefined) cardProps.lifecycleVersion = row.lifecycle_version as number;
          return <AgentCard key={agentId} {...cardProps} />;
        })}
      </div>
    </div>
  );
}

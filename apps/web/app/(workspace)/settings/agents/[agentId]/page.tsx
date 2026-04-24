import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getUserAgentConfiguration } from '@flow/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AgentDetailClient } from './agent-detail-client';
import { TrustSection } from './_components/trust-section';
import type { AgentId } from '@flow/types';

const AGENT_META: Record<string, { label: string; description: string; icon: string }> = {
  inbox: { label: 'Inbox', description: 'Categorize and prioritize your emails automatically', icon: 'inbox' },
  calendar: { label: 'Calendar', description: 'Manage scheduling, conflicts, and availability', icon: 'calendar' },
  'ar-collection': { label: 'AR Collection', description: 'Track overdue invoices and send payment reminders', icon: 'ar' },
  'weekly-report': { label: 'Weekly Report', description: 'Generate summaries of workspace activity', icon: 'report' },
  'client-health': { label: 'Client Health', description: 'Monitor client engagement and retention signals', icon: 'health' },
  'time-integrity': { label: 'Time Integrity', description: 'Audit time entries and flag inconsistencies', icon: 'time' },
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ agentId: string }> }): Promise<Metadata> {
  const { agentId } = await params;
  const meta = AGENT_META[agentId];
  return { title: meta ? `${meta.label} — Agents` : 'Agent' };
}

export default async function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const meta = AGENT_META[agentId];

  if (!meta) {
    notFound();
  }

  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);
  const config = await getUserAgentConfiguration(supabase, workspaceId, agentId);

  const row = config as Record<string, unknown> | null;

  return (
    <div className="space-y-8">
      <AgentDetailClient
        agentId={agentId as AgentId}
        label={meta.label}
        description={meta.description}
        icon={meta.icon}
        status={(row?.status as string) ?? 'inactive'}
        setupCompleted={(row?.setup_completed as boolean) ?? false}
        lifecycleVersion={(row?.lifecycle_version as number) ?? 0}
        schedule={row?.schedule as Record<string, unknown> | null}
        triggerConfig={row?.trigger_config as Record<string, unknown> | null}
      />
      <TrustSection agentId={agentId} />
    </div>
  );
}

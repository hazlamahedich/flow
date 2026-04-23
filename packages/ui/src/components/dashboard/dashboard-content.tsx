import type { DashboardSummary } from '@flow/db';
import type { UserProfile } from '@flow/types';
import { DashboardGreeting } from './dashboard-greeting';
import { DashboardSection } from './dashboard-section';
import { EmptyStateCard } from './empty-state-card';
import {
  Sprout,
  TrendingUp,
  FileText,
  Users,
  CheckCircle2,
} from 'lucide-react';

export interface DashboardContentProps {
  summary: DashboardSummary;
  profile: UserProfile | null;
}

export function DashboardContent({ summary, profile }: DashboardContentProps) {
  const hasClients = summary.clientCount > 0;
  const isFirstRun = !hasClients && summary.agentActivityCount === 0 && summary.pendingApprovals === 0;
  const variant = isFirstRun ? 'first-run' : 'all-clear';

  const firstName = profile?.name?.split(' ')[0] ?? null;
  const timezone = profile?.timezone ?? null;

  return (
    <div className="mx-auto max-w-[var(--flow-layout-main-content)] px-6 py-8">
      <DashboardGreeting
        firstName={firstName}
        timezone={timezone}
        clientCount={summary.clientCount}
        invoiceCount={summary.outstandingInvoices}
        summary={summary}
      />

      <div className="mt-8 space-y-6">
        <DashboardSection
          title="Needs your attention"
          count={summary.pendingApprovals}
          accent="warning"
          id="needs-attention"
        >
          {summary.pendingApprovals === 0 && (
            variant === 'first-run' ? (
              <EmptyStateCard
                icon={Sprout}
                title="Nothing here yet"
                description="Once you have clients and invoices, this is where Flow will flag what needs your attention first."
                variant="first-run"
              />
            ) : (
              <EmptyStateCard
                icon={CheckCircle2}
                title="All clear!"
                description="Nothing needs your eyes right now. Enjoy the breather."
                variant="all-clear"
              />
            )
          )}
        </DashboardSection>

        <DashboardSection
          title="Handled quietly"
          count={summary.agentActivityCount}
          accent="success"
        >
          {summary.agentActivityCount === 0 && (
            variant === 'first-run' ? (
              <EmptyStateCard
                icon={TrendingUp}
                title="Nothing handled yet"
                description="Items your agents handle for you will appear here as you get started."
                variant="first-run"
              />
            ) : (
              <EmptyStateCard
                icon={TrendingUp}
                title="No items handled yet"
                description="Handled items will appear here once your agents start working."
                variant="all-clear"
              />
            )
          )}
        </DashboardSection>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <DashboardSection
            title="Outstanding invoices"
            count={summary.outstandingInvoices}
            accent="info"
          >
            {summary.outstandingInvoices === 0 && (
              variant === 'first-run' ? (
                <EmptyStateCard
                  icon={FileText}
                  title="No invoices yet"
                  description="Create and track invoices for your clients."
                  ctaLabel="Create your first invoice"
                  ctaHref="/invoices"
                  variant="first-run"
                />
              ) : (
                <EmptyStateCard
                  icon={CheckCircle2}
                  title="No outstanding invoices"
                  description="All invoices are paid up."
                  variant="all-clear"
                />
              )
            )}
          </DashboardSection>

          <DashboardSection
            title="Client health"
            count={summary.clientHealthAlerts}
            accent="warning"
          >
            {summary.clientHealthAlerts === 0 && (
              variant === 'first-run' ? (
                <EmptyStateCard
                  icon={Users}
                  title="No clients yet"
                  description="Add clients to track their health and get proactive alerts."
                  ctaLabel="Add your first client"
                  ctaHref="/clients"
                  variant="first-run"
                />
              ) : (
                <EmptyStateCard
                  icon={CheckCircle2}
                  title="All clients healthy"
                  description="No alerts right now. Your clients are in good shape."
                  variant="all-clear"
                />
              )
            )}
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}

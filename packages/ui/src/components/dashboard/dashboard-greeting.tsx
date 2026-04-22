'use client';

import { useMemo } from 'react';
import Link from 'next/link';

export interface DashboardGreetingProps {
  firstName?: string | null | undefined;
  timezone?: string | null | undefined;
  clientCount: number;
  invoiceCount: number;
  summary: {
    pendingApprovals: number;
    agentActivityCount: number;
    outstandingInvoices: number;
    clientHealthAlerts: number;
  };
}

function getValidTimezone(tz: string | null | undefined): string {
  if (!tz) return 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function getTimeBucket(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

function getGreeting(bucket: 'morning' | 'afternoon' | 'evening'): string {
  switch (bucket) {
    case 'morning': return 'Good morning';
    case 'afternoon': return 'Good afternoon';
    case 'evening': return 'Good evening';
  }
}

export function DashboardGreeting({
  firstName,
  timezone,
  clientCount,
  invoiceCount,
  summary,
}: DashboardGreetingProps) {
  const tz = getValidTimezone(timezone);

  const { greeting, dateStr } = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const hourStr = formatter.format(now);
    const hour = parseInt(hourStr, 10);
    const safeHour = Number.isFinite(hour) ? hour : now.getHours();
    const bucket = getTimeBucket(safeHour);

    const namePart = firstName ? `, ${firstName}` : '';
    const greeting = `${getGreeting(bucket)}${namePart}`;

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const dateStr = dateFormatter.format(now);

    return { greeting, dateStr };
  }, [firstName, tz]);

  const isFirstRun = clientCount === 0 && invoiceCount === 0;
  const totalNeedsAttention = summary.pendingApprovals;
  const hasActivity = summary.agentActivityCount > 0 || totalNeedsAttention > 0 || summary.outstandingInvoices > 0 || summary.clientHealthAlerts > 0;

  let content: React.ReactNode;

  if (isFirstRun) {
    content = (
      <div className="border-l-4 border-l-[color:rgba(var(--flow-color-accent-success-raw,16_185_129)/0.4)] pl-4">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Welcome to Flow{firstName ? `, ${firstName}` : ''}!{' '}
          <Link href="/clients" className="underline decoration-[var(--flow-color-accent-success)] underline-offset-2 hover:opacity-80">
            Let&apos;s get your first client set up.
          </Link>
        </h1>
      </div>
    );
  } else if (hasActivity && totalNeedsAttention > 0) {
    content = (
      <div>
        <h1 className="text-xl font-semibold text-[var(--flow-color-text-primary)]">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-[var(--flow-color-text-secondary)]">
          <button
            type="button"
            onClick={() => document.getElementById('needs-attention')?.scrollIntoView({ behavior: 'smooth' })}
            className="underline decoration-[var(--flow-color-text-secondary)] underline-offset-2 hover:text-[var(--flow-color-text-primary)]"
          >
            {totalNeedsAttention} {totalNeedsAttention === 1 ? 'item needs' : 'items need'} your eyes
          </button>
        </p>
      </div>
    );
  } else {
    content = (
      <div>
        <h1 className="text-xl font-semibold text-[var(--flow-color-text-primary)]">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-[var(--flow-color-text-secondary)]">
          You&apos;re all caught up{firstName ? `, ${firstName}` : ''}. Nothing needs your attention right now.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between">
      <div>
        {content}
        <p className="mt-2 text-xs text-[var(--flow-color-text-tertiary)]">{dateStr}</p>
      </div>
    </div>
  );
}

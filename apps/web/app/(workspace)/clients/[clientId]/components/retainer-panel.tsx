'use client';

import { useState } from 'react';
import type { Retainer, UtilizationState } from '@flow/types';
import { RetainerForm } from './retainer-form';
import { RetainerUtilizationBar } from './retainer-utilization-bar';
import { EndRetainerDialog } from './end-retainer-dialog';

interface RetainerPanelProps {
  retainer: Retainer | null;
  utilization: UtilizationState | null;
  clientId: string;
  role: string;
  billingPeriodEnd?: string | null | undefined;
  clientName?: string | undefined;
  overageMinutes?: number | undefined;
  trackedMinutes?: number | undefined;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function RetainerPanel({ retainer, utilization, clientId, role, billingPeriodEnd, clientName, overageMinutes, trackedMinutes }: RetainerPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`retainer-dismissed-${clientId}`) === 'true';
  });
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  if (retainer && showForm) {
    return (
      <RetainerForm
        retainer={retainer}
        clientId={clientId}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  if (!retainer && showForm) {
    return (
      <RetainerForm
        clientId={clientId}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  if (!retainer) {
    if (dismissed) {
      return (
        <div className="rounded-lg border border-[var(--flow-color-border-default)] p-4 text-sm text-[var(--flow-color-text-secondary)]">
          No retainer — <button onClick={() => { setShowForm(true); localStorage.removeItem(`retainer-dismissed-${clientId}`); }} className="text-[var(--flow-accent-primary)] underline">Add one</button>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-[var(--flow-color-border-default)] p-6">
        <h3 className="text-sm font-semibold text-[var(--flow-color-text-primary)]">Retainer Agreement</h3>
        <p className="mt-1 text-sm text-[var(--flow-color-text-secondary)]">
          Track scope and get alerts before you over-deliver.
        </p>
        <div className="mt-4 flex gap-3">
          {isOwnerOrAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md bg-[var(--flow-accent-primary)] px-4 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)]"
            >
              Set up a retainer agreement
            </button>
          )}
          <button
            onClick={() => { setDismissed(true); localStorage.setItem(`retainer-dismissed-${clientId}`, 'true'); }}
            className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm text-[var(--flow-color-text-secondary)]"
          >
            Not needed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="retainer-panel" className="rounded-lg border border-[var(--flow-color-border-default)] p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--flow-color-text-primary)]">Retainer Agreement</h3>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[var(--flow-color-border-default)] px-2.5 py-0.5 text-xs font-medium capitalize">
            {retainer.type.replace('_', ' ')}
          </span>
          {isOwnerOrAdmin && (
            <>
              <button
                onClick={() => setShowForm(true)}
                className="text-xs text-[var(--flow-accent-primary)] underline"
              >
                Edit
              </button>
              <button
                onClick={() => setShowEndDialog(true)}
                className="text-xs text-[var(--flow-status-error)] underline"
              >
                End
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <RetainerDetailLine retainer={retainer} />
      </div>

      {utilization && (
        <div className="mt-4">
          <RetainerUtilizationBar state={utilization} billingPeriodEnd={billingPeriodEnd ?? undefined} overageMinutes={overageMinutes} />
        </div>
      )}

      {showEndDialog && retainer && (
        <EndRetainerDialog
          retainer={retainer}
          trackedMinutes={trackedMinutes ?? 0}
          activeScopeAlerts={0}
          onClose={() => setShowEndDialog(false)}
          onEnded={() => { setShowEndDialog(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}

function RetainerDetailLine({ retainer }: { retainer: Retainer }) {
  if (retainer.type === 'hourly_rate' && retainer.hourlyRateCents != null) {
    return <p>Rate: {formatCents(retainer.hourlyRateCents)}/hr</p>;
  }
  if (retainer.type === 'flat_monthly' && retainer.monthlyFeeCents != null) {
    return <p>Monthly fee: {formatCents(retainer.monthlyFeeCents)}</p>;
  }
  if (retainer.type === 'package_based' && retainer.packageHours) {
    return <p>{retainer.packageName}: {retainer.packageHours}h included</p>;
  }
  return <p className="text-[var(--flow-color-text-secondary)]">Retainer details unavailable</p>;
}

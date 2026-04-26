import Link from 'next/link';
import type { ScopeCreepAlert } from '@flow/types';

interface ScopeAlertsSectionProps {
  alerts: ScopeCreepAlert[];
}

export function ScopeAlertsSection({ alerts }: ScopeAlertsSectionProps) {
  if (alerts.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--flow-color-text-primary)]">Scope Alerts</h2>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <Link
            key={alert.retainerId}
            href={`/clients/${alert.clientId}`}
            className="block rounded-lg border border-[var(--flow-status-warning)] bg-[var(--flow-status-warning)]/5 p-4 transition-colors hover:bg-[var(--flow-status-warning)]/10"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--flow-color-text-primary)]">{alert.clientName}</span>
              <span className="text-sm font-medium text-[var(--flow-status-error)]">{alert.utilizationPercent}%</span>
            </div>
            <p className="mt-1 text-xs text-[var(--flow-color-text-secondary)]">
              {alert.retainerType.replace('_', ' ')} retainer — {Math.floor(alert.trackedMinutes / 60)}h {(alert.trackedMinutes % 60) > 0 ? `${alert.trackedMinutes % 60}m` : ''} tracked of {Math.floor(alert.thresholdMinutes * 100 / 90 / 60)}h allocated
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card, CardHeader, CardContent } from '@flow/ui';
import { activateAgent, deactivateAgent, updateAgentSchedule, updateAgentTriggerConfig } from '@/lib/actions/agent-config/actions';
import type { AgentId, AgentBackendStatus } from '@flow/types';

const STATUS_DISPLAY: Record<string, { label: string; variant: 'default' | 'secondary' | 'error' | 'outline' | 'success' | 'warning' }> = {
  inactive: { label: 'Inactive', variant: 'secondary' },
  activating: { label: 'Activating', variant: 'outline' },
  active: { label: 'Active', variant: 'success' },
  draining: { label: 'Draining', variant: 'warning' },
  suspended: { label: 'Suspended', variant: 'error' },
};

interface AgentDetailClientProps {
  agentId: AgentId;
  label: string;
  description: string;
  icon: string;
  status: string;
  setupCompleted: boolean;
  lifecycleVersion: number;
  schedule: Record<string, unknown> | null;
  triggerConfig: Record<string, unknown> | null;
}

export function AgentDetailClient({
  agentId,
  label,
  description,
  icon,
  status: initialStatus,
  setupCompleted: initialSetupCompleted,
  lifecycleVersion,
  schedule,
  triggerConfig,
}: AgentDetailClientProps) {
  const [isActive, setIsActive] = useState(initialStatus === 'active');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const setupCompleted = initialSetupCompleted;

  const display = STATUS_DISPLAY[initialStatus] ?? STATUS_DISPLAY['inactive']!;

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      try {
        if (isActive) {
          const result = await deactivateAgent({ agentId, expectedVersion: lifecycleVersion });
          if (!result.success) {
            setError(result.error?.message ?? 'Failed to deactivate');
            return;
          }
        } else {
          const result = await activateAgent({ agentId, expectedVersion: lifecycleVersion });
          if (!result.success) {
            setError(result.error?.message ?? 'Failed to activate');
            return;
          }
        }
        setIsActive(!isActive);
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, var(--flow-agent-${icon}) 15%, transparent)` }}
          >
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: `var(--flow-agent-${icon})` }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
              {label}
            </h1>
            <p className="text-sm text-[var(--flow-color-text-secondary)]">
              {description}
            </p>
          </div>
        </div>
        <Badge variant={display.variant}>{display.label}</Badge>
      </div>

      {error && (
        <p className="text-sm text-[var(--flow-status-error)]" role="alert">{error}</p>
      )}

      {!setupCompleted && !isActive && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-[var(--flow-status-warning)]" />
              <span className="text-[var(--flow-status-warning)]">
                Complete setup before activating this agent.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--flow-color-text-primary)]">
              Agent Status
            </h2>
            <Button
              onClick={handleToggle}
              disabled={isPending || (!setupCompleted && !isActive)}
              variant={isActive ? 'destructive' : 'default'}
              size="sm"
            >
              {isPending ? 'Updating...' : isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--flow-color-text-secondary)]">
            {isActive
              ? 'This agent is running and processing tasks according to its schedule.'
              : setupCompleted
                ? 'This agent is configured and ready to activate.'
                : 'Complete the required setup steps to activate this agent.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-[var(--flow-color-text-primary)]">
            Configuration
          </h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <span className="text-xs font-medium text-[var(--flow-color-text-secondary)]">Schedule</span>
              <p className="text-sm text-[var(--flow-color-text-primary)]">
                {schedule?.type === 'always'
                  ? 'Always active'
                  : schedule?.type === 'business_hours'
                    ? `Business hours (${(schedule as Record<string, unknown>).startHour}:00–${(schedule as Record<string, unknown>).endHour}:00)`
                    : schedule?.type === 'custom'
                      ? `Custom cron: ${(schedule as Record<string, unknown>).cron}`
                      : 'Manual activation only'}
              </p>
            </div>
            <div className="border-t border-[var(--flow-color-border-default)] pt-3">
              <span className="text-xs font-medium text-[var(--flow-color-text-secondary)]">Triggers</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {Boolean(triggerConfig?.onNewEmail) && <Badge variant="outline">New Email</Badge>}
                {Boolean(triggerConfig?.onScheduleConflict) && <Badge variant="outline">Schedule Conflict</Badge>}
                {!Boolean(triggerConfig?.onNewEmail) && !Boolean(triggerConfig?.onScheduleConflict) && (
                  <span className="text-xs text-[var(--flow-color-text-muted)]">No triggers configured</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

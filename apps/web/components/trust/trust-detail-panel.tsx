'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '@flow/ui';
import { setTrustLevel, getTrustMatrixAction } from '@/lib/actions/trust-config/actions';
import { TrustLevelSelect } from './trust-level-select';
import { TrustMeter } from './trust-meter';
import { TrustHistory } from './trust-history';
import { PreconditionList } from './precondition-list';
import type { TrustLevel } from '@flow/trust';

interface MatrixEntry {
  id: string;
  agent_id: string;
  action_type: string;
  current_level: TrustLevel;
  score: number;
  version: number;
}

interface Transition {
  id: string;
  from_level: string;
  to_level: string;
  trigger_type: string;
  trigger_reason: string;
  created_at: string;
}

interface Precondition {
  id: string;
  condition_key: string;
  condition_expr: string;
}

interface TrustDetailPanelProps {
  agentId: string;
  initialEntry?: MatrixEntry | null;
  initialTransitions?: Transition[];
  initialPreconditions?: Precondition[];
}

export function TrustDetailPanel({
  agentId,
  initialEntry,
  initialTransitions = [],
  initialPreconditions = [],
}: TrustDetailPanelProps) {
  const [entry, setEntry] = useState<MatrixEntry | null>(initialEntry ?? null);
  const [transitions, setTransitions] = useState<Transition[]>(initialTransitions);
  const [preconditions] = useState<Precondition[]>(initialPreconditions);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await getTrustMatrixAction();
      if (result.success && result.data) {
        const match = (result.data as unknown as MatrixEntry[]).find(
          (e) => e.agent_id === agentId && e.action_type === (entry?.action_type ?? 'general'),
        );
        if (match) setEntry(match);
      }
    });
  }, [agentId]);

  useEffect(() => {
    if (!initialEntry) refresh();
  }, [initialEntry, refresh]);

  function handleLevelChange(level: TrustLevel) {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      const result = await setTrustLevel({
        agentId,
        actionType: entry.action_type,
        level,
        expectedVersion: entry.version,
      });
      if (!result.success) {
        setError(result.error?.message ?? 'Failed to update trust level');
        refresh();
        return;
      }
      refresh();
    });
  }

  const currentLevel: TrustLevel = entry?.current_level ?? 'supervised';
  const score = entry?.score ?? 0;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-[var(--flow-status-error)]" role="alert">{error}</p>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-[var(--flow-text-primary)]">Trust Settings</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <TrustLevelSelect
            value={currentLevel}
            onChange={handleLevelChange}
            disabled={isPending}
          />
          <TrustMeter score={score} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <TrustHistory transitions={transitions} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <PreconditionList
            agentId={agentId}
            actionType={entry?.action_type ?? 'general'}
            conditions={preconditions}
          />
        </CardContent>
      </Card>
    </div>
  );
}

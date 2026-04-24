'use client';

import { useState, useTransition } from 'react';
import { Button } from '@flow/ui';
import { createPrecondition, deletePreconditionAction } from '@/lib/actions/trust-config/actions';

interface Precondition {
  id: string;
  condition_key: string;
  condition_expr: string;
}

interface PreconditionListProps {
  agentId: string;
  actionType: string;
  conditions: Precondition[];
}

export function PreconditionList({ agentId, actionType, conditions: initial }: PreconditionListProps) {
  const [conditions, setConditions] = useState(initial);
  const [newKey, setNewKey] = useState('');
  const [newExpr, setNewExpr] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!newKey.trim() || !newExpr.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createPrecondition({
        agentId,
        actionType,
        conditionKey: newKey.trim(),
        conditionExpr: newExpr.trim(),
      });
      if (!result.success) {
        setError(result.error?.message ?? 'Failed to add condition');
        return;
      }
      const data = result.data as unknown as Precondition;
      setConditions((prev) => [...prev, data]);
      setNewKey('');
      setNewExpr('');
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deletePreconditionAction({ id });
      if (!result.success) {
        setError(result.error?.message ?? 'Failed to delete condition');
        return;
      }
      setConditions((prev) => prev.filter((c) => c.id !== id));
    });
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-[var(--flow-text-secondary)]">Preconditions</span>

      {error && <p className="text-xs text-[var(--flow-status-error)]" role="alert">{error}</p>}

      {conditions.length > 0 && (
        <ul className="space-y-1">
          {conditions.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-[var(--flow-radius-sm)] border border-[var(--flow-border-default)] px-2 py-1.5 text-xs">
              <div className="flex items-center gap-2">
                <code className="font-mono text-[var(--flow-text-primary)]">{c.condition_key}</code>
                <span className="text-[var(--flow-text-muted)]">=</span>
                <code className="font-mono text-[var(--flow-text-secondary)]">{c.condition_expr}</code>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                disabled={isPending}
                className="text-[var(--flow-text-muted)] hover:text-[var(--flow-status-error)] disabled:opacity-50"
                aria-label={`Delete condition ${c.condition_key}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          disabled={isPending}
          maxLength={100}
          className="w-24 rounded-[var(--flow-radius-sm)] border border-[var(--flow-border-default)] bg-transparent px-2 py-1 text-xs text-[var(--flow-text-primary)] placeholder:text-[var(--flow-text-muted)] disabled:opacity-50"
        />
        <input
          type="text"
          placeholder="Expression"
          value={newExpr}
          onChange={(e) => setNewExpr(e.target.value)}
          disabled={isPending}
          maxLength={500}
          className="flex-1 rounded-[var(--flow-radius-sm)] border border-[var(--flow-border-default)] bg-transparent px-2 py-1 text-xs text-[var(--flow-text-primary)] placeholder:text-[var(--flow-text-muted)] disabled:opacity-50"
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={isPending || !newKey.trim() || !newExpr.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

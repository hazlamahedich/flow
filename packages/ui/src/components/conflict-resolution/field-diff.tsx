'use client';

import { cn } from '../../lib/utils';
import type { FieldResolution, DiffField } from '@flow/db/queries/undo/conflict-types';

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

interface FieldDiffProps {
  field: DiffField;
  choice?: FieldResolution;
  onChoice: (fieldName: string, choice: FieldResolution) => void;
}

export function FieldDiff({ field, choice, onChoice }: FieldDiffProps) {
  return (
    <div className="space-y-2 rounded border border-[var(--flow-color-border-primary)] p-3">
      <p className="text-sm text-[var(--flow-color-text-primary)]">
        You changed <strong>{field.fieldLabel}</strong> to{' '}
        <span className="rounded bg-[var(--flow-color-bg-surface-hover)] px-1.5 py-0.5 font-mono text-xs">
          {formatValue(field.clientValue)}
        </span>.{' '}
        The current value is{' '}
        <span className="rounded bg-[var(--flow-color-bg-surface-hover)] px-1.5 py-0.5 font-mono text-xs">
          {formatValue(field.serverValue)}
        </span>.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onChoice(field.fieldName, 'keep_client')}
          className={cn(
            'rounded px-3 py-1 text-sm border',
            choice === 'keep_client'
              ? 'border-[var(--flow-accent-primary)] bg-[var(--flow-accent-primary)] text-white'
              : 'border-[var(--flow-color-border-primary)] text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-surface-hover)]',
          )}
        >
          Keep yours
        </button>
        <button
          onClick={() => onChoice(field.fieldName, 'keep_server')}
          className={cn(
            'rounded px-3 py-1 text-sm border',
            choice === 'keep_server' || !choice
              ? 'border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-hover)] text-[var(--flow-color-text-primary)]'
              : 'border-[var(--flow-color-border-primary)] text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-surface-hover)]',
          )}
        >
          Keep current
        </button>
      </div>
    </div>
  );
}

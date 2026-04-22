'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { mergeNonConflicting } from '@flow/db/queries/undo/conflict-detection';
import type { ConflictInfo, FieldResolution, ConflictResolution } from '@flow/db/queries/undo/conflict-types';

interface ConflictDialogProps {
  conflictInfo: ConflictInfo;
  clientState?: Record<string, unknown>;
  serverState?: Record<string, unknown>;
  clientLabel?: string;
  serverLabel?: string;
  onResolve: (resolution: ConflictResolution, mergedData: Record<string, unknown>) => void;
  onDismiss: () => void;
}

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

export function ConflictDialog({
  conflictInfo,
  clientState,
  serverState,
  clientLabel = 'Your changes',
  serverLabel = 'Current version',
  onResolve,
  onDismiss,
}: ConflictDialogProps) {
  const [resolution, setResolution] = useState<ConflictResolution>({});
  const { ref: trapRef } = useFocusTrap<HTMLDivElement>();
  const reducedMotion = useReducedMotion();

  const handleFieldChoice = useCallback(
    (fieldName: string, choice: FieldResolution) => {
      setResolution((prev) => ({ ...prev, [fieldName]: choice }));
    },
    [],
  );

  const handleResolve = useCallback(() => {
    const cs = clientState ?? {};
    const ss = serverState ?? {};
    const mergedData = mergeNonConflicting(cs, ss, conflictInfo, resolution);
    onResolve(resolution, mergedData);
  }, [resolution, onResolve, conflictInfo, clientState, serverState]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[var(--flow-z-overlay)] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Resolve edit conflict"
    >
      <div
        ref={trapRef}
        className={cn(
          'mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-raised)] shadow-xl',
          reducedMotion ? '' : 'animate-in fade-in zoom-in-95',
        )}
        style={{ animationDuration: reducedMotion ? '0ms' : '150ms' }}
      >
        <div className="border-b border-[var(--flow-color-border-primary)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
            Resolve Edit Conflict
          </h2>
          <p className="mt-1 text-sm text-[var(--flow-color-text-secondary)]">
            This record was modified by someone else. Choose which changes to keep.
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="hidden sm:grid sm:grid-cols-2 gap-4 text-sm font-medium text-[var(--flow-color-text-secondary)]">
            <span>{clientLabel}</span>
            <span>{serverLabel}</span>
          </div>

          {conflictInfo.conflictingFields.map((field) => (
            <div key={field.fieldName} className="space-y-2">
              <p className="text-sm text-[var(--flow-color-text-primary)]">
                You changed <strong>{field.fieldLabel}</strong> to{' '}
                <span className="font-mono text-sm">{formatValue(field.clientValue)}</span>.
                The current value is{' '}
                <span className="font-mono text-sm">{formatValue(field.serverValue)}</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleFieldChoice(field.fieldName, 'keep_client')}
                  className={cn(
                    'rounded px-3 py-1 text-sm border',
                    resolution[field.fieldName] === 'keep_client'
                      ? 'border-[var(--flow-accent-primary)] bg-[var(--flow-accent-primary)] text-white'
                      : 'border-[var(--flow-color-border-primary)] text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-surface-hover)]',
                  )}
                >
                  Keep yours
                </button>
                <button
                  onClick={() => handleFieldChoice(field.fieldName, 'keep_server')}
                  className={cn(
                    'rounded px-3 py-1 text-sm border',
                    resolution[field.fieldName] === 'keep_server' || !resolution[field.fieldName]
                      ? 'border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-hover)] text-[var(--flow-color-text-primary)]'
                      : 'border-[var(--flow-color-border-primary)] text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-surface-hover)]',
                  )}
                >
                  Keep current
                </button>
              </div>
            </div>
          ))}

          {conflictInfo.autoMergedFields.length > 0 && (
            <div className="rounded border border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-secondary)] px-4 py-3">
              <p className="text-sm font-medium text-[var(--flow-color-text-primary)]">
                These changes will be kept:
              </p>
              <ul className="mt-1 text-sm text-[var(--flow-color-text-secondary)]">
                {conflictInfo.autoMergedFields.map((f) => (
                  <li key={f.fieldName}>{f.fieldLabel}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--flow-color-border-primary)] px-6 py-4">
          <button
            onClick={onDismiss}
            className="rounded px-4 py-2 text-sm text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-surface-hover)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)]"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            className="rounded bg-[var(--flow-accent-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)]"
          >
            Apply Resolution
          </button>
        </div>
      </div>
    </div>
  );
}

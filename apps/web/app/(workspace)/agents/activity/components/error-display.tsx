'use client';

import type { AgentRunError } from '@flow/db';
import { ERROR_TONE } from '../../constants/activity-copy';

interface ErrorDisplayProps {
  error: Record<string, unknown> | null;
}

function parseError(raw: Record<string, unknown> | null): AgentRunError {
  if (!raw) return { code: 'unknown', entity: undefined, resolution: undefined, retryable: false };
  return {
    code: (raw.code as string) ?? 'unknown',
    entity: raw.entity as string | undefined,
    resolution: raw.resolution as string | undefined,
    retryable: raw.retryable === true,
  };
}

export function ErrorDisplay({ error }: ErrorDisplayProps) {
  const parsed = parseError(error);

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
      <p className="text-sm font-medium text-amber-800">{ERROR_TONE.header}</p>
      <p className="text-xs text-amber-700">
        <span className="font-mono bg-amber-100 px-1 rounded">{parsed.code}</span>
        {parsed.entity && <span className="ml-2">Affected: {parsed.entity}</span>}
      </p>
      {parsed.resolution && (
        <p className="text-xs text-amber-700">{parsed.resolution}</p>
      )}
      {parsed.retryable && (
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-amber-800 hover:text-amber-900 underline"
        >
          {ERROR_TONE.cta}
        </button>
      )}
    </div>
  );
}

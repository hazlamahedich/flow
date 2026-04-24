'use client';

import { Badge } from '@flow/ui';
import type { TrustLevel } from '@flow/trust';

const LEVEL_CONFIG: Record<TrustLevel, { label: string; badge: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'outline'; emotion: string; description: string }> = {
  supervised: {
    label: 'Supervised',
    badge: 'warning',
    emotion: 'var(--flow-emotion-tension)',
    description: 'Agent asks before every action',
  },
  confirm: {
    label: 'Confirm',
    badge: 'default',
    emotion: 'var(--flow-emotion-trust-building)',
    description: 'Agent acts, then asks you to confirm',
  },
  auto: {
    label: 'Auto',
    badge: 'success',
    emotion: 'var(--flow-emotion-trust-auto)',
    description: 'Agent acts independently within guardrails',
  },
};

interface TrustLevelSelectProps {
  value: TrustLevel;
  onChange: (level: TrustLevel) => void;
  disabled?: boolean;
}

export function TrustLevelSelect({ value, onChange, disabled }: TrustLevelSelectProps) {
  const config = LEVEL_CONFIG[value];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--flow-text-secondary)]">Trust Level</span>
        <Badge variant={config.badge}>{config.label}</Badge>
      </div>
      <div className="flex gap-2">
        {(Object.entries(LEVEL_CONFIG) as [TrustLevel, typeof config][]).map(([level, cfg]) => (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level)}
            className={`flex-1 rounded-[var(--flow-radius-md)] border px-3 py-2 text-left transition-colors disabled:opacity-50 ${
              level === value
                ? 'border-[var(--flow-border-strong)] bg-[var(--flow-bg-surface-raised)]'
                : 'border-[var(--flow-border-default)] hover:border-[var(--flow-border-strong)]'
            }`}
            aria-pressed={level === value}
          >
            <div className="text-xs font-medium text-[var(--flow-text-primary)]">{cfg.label}</div>
            <div className="mt-0.5 text-[10px] text-[var(--flow-text-muted)]">{cfg.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

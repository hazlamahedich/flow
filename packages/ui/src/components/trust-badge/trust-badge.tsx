'use client';

import { cn } from '../../lib/utils';
import { useTrustBadgeAnimation } from './use-trust-badge-animation';

export interface TrustBadgeProps {
  label: string;
  colorToken: string;
  borderStyle: string;
  animState: 'default' | 'promoting' | 'regressing';
  variant?: 'inline' | 'sidebar';
  agentLabel?: string;
  className?: string;
}

export function TrustBadge({
  label,
  colorToken,
  borderStyle,
  animState,
  variant = 'inline',
  agentLabel,
  className,
}: TrustBadgeProps) {
  const animStyle = useTrustBadgeAnimation(animState);

  if (variant === 'sidebar') {
    return (
      <span
        className={cn('inline-block rounded-full', className)}
        style={{
          width: 8,
          height: 8,
          backgroundColor: `var(${colorToken})`,
          ...animStyle,
        }}
        role="status"
        aria-live={animState === 'regressing' ? 'assertive' : 'polite'}
        aria-label={`${agentLabel ?? 'Agent'} trust: ${label}`}
        title={`${agentLabel ?? 'Agent'} trust: ${label}`}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{
        color: `var(${colorToken})`,
        backgroundColor: `var(${colorToken}-light, color-mix(in srgb, var(${colorToken}) 12%, transparent))`,
        border: borderStyle !== 'none'
          ? `${borderStyle} var(${colorToken})`
          : 'none',
        ...animStyle,
      }}
      role="status"
      aria-live={animState === 'regressing' ? 'assertive' : 'polite'}
      aria-label={`${agentLabel ?? 'Agent'} trust: ${label}`}
    >
      {label}
    </span>
  );
}

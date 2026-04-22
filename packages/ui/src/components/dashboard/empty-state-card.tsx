import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface EmptyStateCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  variant: 'first-run' | 'all-clear';
}

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  variant,
}: EmptyStateCardProps) {
  const borderClass =
    variant === 'first-run' ? 'border-dashed' : 'border-solid';

  const ctaElement = ctaLabel && ctaHref
    ? (
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1.5 rounded-[var(--flow-radius-sm)] bg-[var(--flow-color-accent-gold)] px-3 py-1.5 text-sm font-medium text-[var(--flow-color-text-on-accent)] transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] focus-visible:outline-offset-1"
      >
        {ctaLabel}
      </Link>
    )
    : ctaLabel && ctaOnClick
      ? (
        <button
          type="button"
          onClick={ctaOnClick}
          className="inline-flex items-center gap-1.5 rounded-[var(--flow-radius-sm)] bg-[var(--flow-color-accent-gold)] px-3 py-1.5 text-sm font-medium text-[var(--flow-color-text-on-accent)] transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] focus-visible:outline-offset-1"
        >
          {ctaLabel}
        </button>
      )
      : null;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-[var(--flow-radius-lg)] border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] p-6 text-center',
        borderClass,
      )}
      role="region"
      aria-label={title}
    >
      <Icon className="h-8 w-8 text-[var(--flow-color-text-tertiary)]" aria-hidden="true" />
      <h3 className="text-sm font-medium text-[var(--flow-color-text-primary)]">{title}</h3>
      <p className="text-sm text-[var(--flow-color-text-secondary)]">{description}</p>
      {ctaElement}
    </div>
  );
}

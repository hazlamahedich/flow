import type { ReactNode } from 'react';

export interface DashboardSectionProps {
  title: string;
  count?: number;
  accent?: 'warning' | 'success' | 'info';
  id?: string;
  children?: ReactNode;
}

export function DashboardSection({
  title,
  count,
  accent,
  id,
  children,
}: DashboardSectionProps) {
  const accentColors: Record<string, string> = {
    warning: 'var(--flow-color-text-warning)',
    success: 'var(--flow-color-accent-success)',
    info: 'var(--flow-color-text-tertiary)',
  };

  const sectionId = id ?? `section-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const headingId = `${sectionId}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="rounded-[var(--flow-radius-lg)] border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)]"
    >
      <div
        className="flex items-center justify-between border-b border-[var(--flow-color-border-default)] px-4 py-3"
        style={accent ? { borderLeftWidth: '3px', borderLeftColor: accentColors[accent] ?? undefined } : undefined}
      >
        <h2
          id={headingId}
          className="text-sm font-medium text-[var(--flow-color-text-primary)]"
        >
          {title}
        </h2>
        {count !== undefined && (
          <span className="inline-flex items-center rounded-full bg-[var(--flow-state-overlay-hover)] px-2 py-0.5 text-xs font-medium text-[var(--flow-color-text-secondary)]">
            {count}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

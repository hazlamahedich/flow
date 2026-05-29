import { cn } from '@flow/ui';
import type { TemplateListItem } from '@flow/types';

interface TemplateCardProps {
  template: TemplateListItem;
  isDefault: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function TemplateCard({ template, isDefault, onEdit, onDelete }: TemplateCardProps) {
  const sectionsConfig = (template.sectionsConfig ?? {}) as Record<string, { enabled?: boolean; sort_order?: number }>;
  const enabledSections = Object.entries(sectionsConfig)
    .filter(([, cfg]) => cfg?.enabled)
    .sort(([, a], [, b]) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
    .map(([key]) => key);

  const branding = (template.branding ?? {}) as { accentColor?: string };
  const accent = branding.accentColor ?? '#6366f1';

  return (
    <div
      data-testid="template-card"
      className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-muted-foreground/20"
      style={{ borderColor: accent }}
    >
      <div className="flex items-start justify-between"
      >
        <div className="space-y-1"
        >
          <h3 data-testid="template-name" className="text-base font-semibold">
            {template.name}
          </h3>
          {isDefault && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
            >
              Workspace Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-2"
        >
          {onEdit && (
            <button
              type="button"
              data-testid="template-edit-btn"
              onClick={() => onEdit(template.id)}
              className="text-sm text-primary hover:underline"
            >
              Edit
            </button>
          )}
          {onDelete && !isDefault && (
            <button
              type="button"
              data-testid="template-delete-btn"
              onClick={() => onDelete(template.id)}
              className="text-sm text-destructive hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2"
      >
        {enabledSections.map((s) => (
          <span
            key={s}
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              'bg-muted text-muted-foreground',
            )}
          >
            {s.replace(/_/g, ' ')}
          </span>
        ))}
        {enabledSections.length === 0 && (
          <span className="text-xs text-muted-foreground">No sections enabled</span>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground"
      >
        Last updated {(() => { const d = new Date(template.updatedAt); return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleDateString(); })()}
      </p>
    </div>
  );
}

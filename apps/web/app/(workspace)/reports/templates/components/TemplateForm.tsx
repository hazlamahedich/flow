'use client';

import { useState } from 'react';
import type { SaveReportTemplateInput } from '@flow/types';

const SECTION_TYPES = [
  { key: 'time_summary', label: 'Time Summary' },
  { key: 'task_log', label: 'Task Log' },
  { key: 'agent_activity', label: 'Agent Activity' },
  { key: 'invoice_summary', label: 'Invoice Summary' },
] as const;

const DESIGN_SYSTEM_PALETTE = [
  '#6366f1',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#64748b',
  '#18181b',
];

interface SectionConfig {
  enabled: boolean;
  sort_order: number;
}

interface TemplateFormProps {
  initial?: {
    id?: string | undefined;
    clientId?: string | undefined;
    name: string;
    sectionsConfig: Record<string, SectionConfig>;
    branding: { accentColor: string; logoUrl?: string | undefined };
  };
  clients: Array<{ id: string; name: string }>;
  onSubmit: (data: SaveReportTemplateInput) => void | Promise<void>;
  onCancel: () => void;
}

export function TemplateForm({
  initial,
  clients,
  onSubmit,
  onCancel,
}: TemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [sectionsConfig, setSectionsConfig] = useState<
    Record<string, SectionConfig>
  >(
    initial?.sectionsConfig ?? {
      time_summary: { enabled: true, sort_order: 1 },
      task_log: { enabled: true, sort_order: 2 },
      agent_activity: { enabled: true, sort_order: 3 },
      invoice_summary: { enabled: true, sort_order: 4 },
    },
  );
  const [accentColor, setAccentColor] = useState(
    initial?.branding?.accentColor ?? '#6366f1',
  );
  const [logoUrl, setLogoUrl] = useState(initial?.branding?.logoUrl ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const enabledCount = Object.values(sectionsConfig).filter(
    (c) => c.enabled,
  ).length;

  function handleToggle(key: string) {
    setSectionsConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, enabled: !prev[key]!.enabled },
    }));
  }

  function handleSortOrderChange(key: string, value: string) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    setSectionsConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, sort_order: num },
    }));
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Name is required';
    if (enabledCount < 1)
      nextErrors.sections = 'At least one section must be enabled';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: SaveReportTemplateInput = {
      ...(initial?.id ? { id: initial.id } : {}),
      ...(clientId ? { clientId } : {}),
      name: name.trim(),
      sectionsConfig: Object.fromEntries(
        Object.entries(sectionsConfig).map(([k, v]) => [
          k,
          { enabled: v.enabled, sort_order: v.sort_order },
        ]),
      ),
      branding: {
        accentColor,
        ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
      },
    };

    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="template-name" className="text-sm font-medium">
          Template Name
        </label>
        <input
          id="template-name"
          data-testid="template-form-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="e.g. Standard Weekly Report"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name}</p>
        )}
      </div>

      {clients.length > 0 && (
        <div className="space-y-2">
          <label htmlFor="template-client" className="text-sm font-medium">
            Client Override (optional)
          </label>
          <select
            id="template-client"
            data-testid="template-form-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          >
            <option value="">Workspace default</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium">Sections</p>
        <div className="space-y-2">
          {SECTION_TYPES.map((sec) => {
            const cfg = sectionsConfig[sec.key] ?? {
              enabled: false,
              sort_order: 1,
            };
            return (
              <div
                key={sec.key}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <label className="flex items-center gap-2 flex-1">
                  <input
                    data-testid={`toggle-${sec.key}`}
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={() => handleToggle(sec.key)}
                    className="h-4 w-4 rounded border-muted"
                  />
                  <span className="text-sm">{sec.label}</span>
                </label>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={`sort-${sec.key}`}
                    className="text-xs text-muted-foreground"
                  >
                    Order
                  </label>
                  <input
                    id={`sort-${sec.key}`}
                    data-testid={`sort-${sec.key}`}
                    type="number"
                    min={1}
                    max={4}
                    value={cfg.sort_order}
                    onChange={(e) =>
                      handleSortOrderChange(sec.key, e.target.value)
                    }
                    className="w-16 rounded-md border px-2 py-1 text-sm text-center"
                  />
                </div>
              </div>
            );
          })}
        </div>
        {errors.sections && (
          <p className="text-xs text-destructive">{errors.sections}</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Accent Color</p>
        <div
          data-testid="template-form-color-picker"
          className="flex flex-wrap gap-2"
        >
          {DESIGN_SYSTEM_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Select ${color}`}
              data-testid={`color-${color}`}
              onClick={() => setAccentColor(color)}
              className={`h-8 w-8 rounded-full border-2 transition-transform ${
                accentColor === color
                  ? 'border-foreground scale-110'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="template-logo" className="text-sm font-medium">
          Logo URL (optional)
        </label>
        <input
          id="template-logo"
          data-testid="template-form-logo"
          type="text"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="https://example.com/logo.png"
        />
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          data-testid="template-form-submit"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {initial?.id ? 'Update Template' : 'Create Template'}
        </button>
        <button
          type="button"
          data-testid="template-form-cancel"
          onClick={onCancel}
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

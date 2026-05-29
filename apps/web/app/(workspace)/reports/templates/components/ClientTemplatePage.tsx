'use client';

import { useState } from 'react';
import { saveReportTemplateAction, deleteReportTemplateAction } from '../../actions';
import { TemplateCard } from './TemplateCard';
import { TemplateForm } from './TemplateForm';
import type { SaveReportTemplateInput, TemplateListItem } from '@flow/types';

interface ClientTemplatePageProps {
  items: TemplateListItem[];
  clients: Array<{ id: string; name: string }>;
}

export function ClientTemplatePage({ items, clients }: ClientTemplatePageProps) {
  const [templates, setTemplates] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const editingTemplate = editingId ? templates.find((t) => t.id === editingId) : undefined;

  async function handleSave(data: SaveReportTemplateInput) {
    setActionError(null);
    const result = await saveReportTemplateAction(data);
    if (result.success) {
      setTemplates((prev) => {
        const existing = prev.findIndex((t) => t.id === result.data.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = {
            id: result.data.id,
            clientId: result.data.clientId,
            name: result.data.name,
            sectionsConfig: result.data.sectionsConfig,
            branding: result.data.branding,
            updatedAt: result.data.updatedAt,
          };
          return next;
        }
        return [
          {
            id: result.data.id,
            clientId: result.data.clientId,
            name: result.data.name,
            sectionsConfig: result.data.sectionsConfig,
            branding: result.data.branding,
            updatedAt: result.data.updatedAt,
          },
          ...prev,
        ];
      });
      setEditingId(null);
    } else {
      setActionError(result.error.message ?? 'Failed to save template.');
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    const result = await deleteReportTemplateAction({ id });
    if (result.success) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } else {
      setActionError(result.error.message ?? 'Failed to delete template.');
    }
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div data-testid="template-action-error" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Report Templates</h1>
        <button
          type="button"
          data-testid="new-template-btn"
          onClick={() => setEditingId(null)}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Template
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isDefault={template.clientId == null}
            onEdit={(id) => setEditingId(id)}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <div className="pt-8 border-t">
        <h2 className="text-lg font-semibold mb-4">
          {editingTemplate ? 'Edit Template' : 'Create Template'}
        </h2>
        <TemplateForm
          key={editingId ?? 'new'}
          {...(editingTemplate
            ? {
                initial: {
                  id: editingTemplate.id,
                  name: editingTemplate.name,
                  sectionsConfig: (editingTemplate.sectionsConfig ?? {}) as Record<
                    string,
                    { enabled: boolean; sort_order: number }
                  >,
                  branding: {
                    accentColor:
                      ((editingTemplate.branding as Record<string, unknown> | undefined)?.accentColor as string | undefined) ??
                      '#6366f1',
                  },
                  ...(editingTemplate.clientId != null ? { clientId: editingTemplate.clientId } : {}),
                },
              }
            : {})}
          clients={clients}
          onSubmit={handleSave}
          onCancel={() => setEditingId(null)}
        />
      </div>
    </div>
  );
}

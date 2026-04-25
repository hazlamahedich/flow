'use client';

import { useState, useRef, useEffect } from 'react';
import type { AgentProposal } from '@flow/types';

interface InlineEditFormProps {
  proposal: AgentProposal;
  reasoning: string;
  onSave: (changes: Partial<Pick<AgentProposal, 'title' | 'confidence' | 'riskLevel'>>) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
  onEscape: () => void;
}

export function InlineEditForm({
  proposal,
  reasoning,
  onSave,
  onCancel,
  onEscape,
}: InlineEditFormProps) {
  const [title, setTitle] = useState(proposal.title);
  const [confidence, setConfidence] = useState(proposal.confidence);
  const [riskLevel, setRiskLevel] = useState(proposal.riskLevel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }
    const clamped = Math.max(0, Math.min(1, confidence));

    setSaving(true);
    setError(null);

    const changes: Partial<Pick<AgentProposal, 'title' | 'confidence' | 'riskLevel'>> = {};
    if (trimmed !== proposal.title) changes.title = trimmed;
    if (clamped !== proposal.confidence) changes.confidence = clamped;
    if (riskLevel !== proposal.riskLevel) changes.riskLevel = riskLevel;

    if (Object.keys(changes).length === 0) {
      setSaving(false);
      onCancel();
      return;
    }

    const result = await onSave(changes);
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? 'This proposal changed since you started editing.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onEscape();
    }
  };

  return (
    <div className="mt-3 border-t border-[var(--flow-border-default)] pt-3" onKeyDown={handleKeyDown}>
      <div className="rounded-[var(--flow-radius-md)] bg-[var(--flow-bg-surface-raised)] p-3 text-sm text-[var(--flow-text-secondary)] mb-3">
        <p className="font-medium text-[var(--flow-text-primary)] text-xs mb-1">Agent Reasoning</p>
        <p>{reasoning}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-[var(--flow-text-secondary)]" htmlFor="edit-title">
            Title
          </label>
          <input
            ref={titleRef}
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-border-default)] bg-[var(--flow-bg-surface)] px-3 py-2 text-sm text-[var(--flow-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-accent-primary)]"
            disabled={saving}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-[var(--flow-text-secondary)]" htmlFor="edit-confidence">
              Confidence (0-1)
            </label>
            <input
              id="edit-confidence"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="mt-1 w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-border-default)] bg-[var(--flow-bg-surface)] px-3 py-2 text-sm text-[var(--flow-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-accent-primary)]"
              disabled={saving}
            />
          </div>

          <div className="w-32">
            <label className="text-xs font-medium text-[var(--flow-text-secondary)]" htmlFor="edit-risk">
              Risk Level
            </label>
            <select
              id="edit-risk"
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value as 'low' | 'medium' | 'high')}
              className="mt-1 w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-border-default)] bg-[var(--flow-bg-surface)] px-3 py-2 text-sm text-[var(--flow-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-accent-primary)]"
              disabled={saving}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="text-xs text-[var(--flow-status-error)]" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-[var(--flow-radius-md)] border border-[var(--flow-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--flow-text-secondary)] hover:bg-[var(--flow-bg-surface-raised)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-[var(--flow-radius-md)] bg-[var(--flow-accent-primary)] px-3 py-1.5 text-xs font-medium text-[var(--flow-accent-primary-text)] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  editDraft,
  quickEditTone,
  quickEditLength,
} from '../actions/draft-actions';
import { Button } from '@flow/ui';
import { Sparkles, Save, RotateCcw, MessageSquare, List } from 'lucide-react';
import { cn } from '@flow/ui';

interface DraftEditorProps {
  draftId: string;
  initialContent: string;
  onSave?: () => void;
}

export function DraftEditor({
  draftId,
  initialContent,
  onSave,
}: DraftEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isPending, setIsPending] = useState(false);

  const handleSave = async () => {
    setIsPending(true);
    try {
      const result = await editDraft({ draftId, content });
      if (result.success && onSave) onSave();
    } finally {
      setIsPending(false);
    }
  };

  const handleToneChange = async (
    tone: 'professional' | 'friendly' | 'concise' | 'detailed',
  ) => {
    setIsPending(true);
    try {
      const result = await quickEditTone({ draftId, tone });
      if (result.success && result.data?.content) {
        setContent(result.data.content);
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleLengthChange = async (length: 'shorter' | 'longer') => {
    setIsPending(true);
    try {
      const result = await quickEditLength({ draftId, length });
      if (result.success && result.data?.content) {
        setContent(result.data.content);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative group">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isPending}
          className={cn(
            'w-full min-h-[300px] p-4 rounded-xl border border-[var(--flow-color-border-default)] bg-[var(--flow-bg-surface)] text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[var(--flow-accent-primary)]/20 transition-all',
            isPending && 'opacity-50',
          )}
          placeholder="Draft response..."
        />

        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-xl">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm border border-[var(--flow-color-border-subtle)]">
              <Sparkles className="w-4 h-4 text-[var(--flow-color-gold)] animate-pulse" />
              <span className="text-xs font-bold text-[var(--flow-color-text-secondary)]">
                AI is rewriting...
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--flow-color-text-muted)] mr-2">
          Quick Edits
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleToneChange('professional')}
          disabled={isPending}
          className="h-7 px-2.5 text-[11px] rounded-full border-dashed"
        >
          Professional
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleToneChange('friendly')}
          disabled={isPending}
          className="h-7 px-2.5 text-[11px] rounded-full border-dashed"
        >
          Friendly
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleLengthChange('shorter')}
          disabled={isPending}
          className="h-7 px-2.5 text-[11px] rounded-full border-dashed"
        >
          Shorter
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleLengthChange('longer')}
          disabled={isPending}
          className="h-7 px-2.5 text-[11px] rounded-full border-dashed"
        >
          Longer
        </Button>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[var(--flow-color-border-subtle)]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setContent(initialContent)}
          disabled={isPending || content === initialContent}
          className="text-[var(--flow-color-text-secondary)]"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={isPending || content === initialContent}
            className="rounded-full px-6"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

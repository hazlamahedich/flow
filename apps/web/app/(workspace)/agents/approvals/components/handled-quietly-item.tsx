'use client';

import { useTransition } from 'react';
import { promoteToInbox } from '../actions/handled-quietly-actions';
import { Mail, ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@flow/ui';

interface HandledQuietlyItemProps {
  email: any;
}

export function HandledQuietlyItem({ email }: HandledQuietlyItemProps) {
  const [isPending, startTransition] = useTransition();

  const handlePromote = () => {
    startTransition(async () => {
      await promoteToInbox({ emailId: email.id });
    });
  };

  const isInfo = email.category === 'info';

  return (
    <div
      className={cn(
        'group relative p-3 rounded-lg border border-[var(--flow-color-border-subtle)] bg-[var(--flow-bg-surface-raised)] transition-all hover:border-[var(--flow-status-warning)]/30 hover:shadow-sm',
        isPending && 'opacity-50 grayscale pointer-events-none',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-1 flex items-center justify-center w-8 h-8 rounded-full',
            isInfo ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600',
          )}
        >
          <Mail className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--flow-color-text-secondary)]">
              {email.category}
            </span>
            <span className="text-[10px] text-[var(--flow-color-text-muted)]">
              {formatDistanceToNow(new Date(email.received_at))} ago
            </span>
          </div>

          <h4 className="text-sm font-medium text-[var(--flow-color-text-primary)] truncate">
            {email.subject || '(No Subject)'}
          </h4>
          <p className="text-xs text-[var(--flow-color-text-secondary)] truncate">
            {email.sender}
          </p>
        </div>
      </div>

      <button
        onClick={handlePromote}
        disabled={isPending}
        data-testid="promote-to-inbox-button"
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-[var(--flow-status-warning)]/30 text-[var(--flow-status-warning)] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--flow-status-warning)]/5"
      >
        <ArrowUpRight className="w-3.5 h-3.5" />
        Actually, this needed my attention
      </button>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-[var(--flow-status-warning)] opacity-50 transition-all"
            style={{ width: `${(email.confidence || 0.5) * 100}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-[var(--flow-color-text-muted)]">
          {Math.round((email.confidence || 0) * 100)}%
        </span>
      </div>
    </div>
  );
}

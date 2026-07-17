'use client';

import { useEffect, useRef, useState } from 'react';
import { EmailTimelineEntry } from '@flow/types';
import { Badge, Button } from '@flow/ui';
import { Mail, Check, X, ArrowRightLeft } from 'lucide-react';
import { recategorizeTimelineEmail } from '../actions/timeline';

interface EmailTimelineItemProps {
  email: EmailTimelineEntry;
  workspaceId: string;
  clientId: string;
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; variant: 'error' | 'warning' | 'default' | 'secondary' }
> = {
  urgent: { label: 'Urgent', variant: 'error' },
  action: { label: 'Action', variant: 'warning' },
  info: { label: 'Info', variant: 'default' },
  noise: { label: 'Noise', variant: 'secondary' },
};

const CATEGORIES = ['urgent', 'action', 'info', 'noise'] as const;

function formatRelativeTime(date: Date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function EmailTimelineItem({
  email,
  workspaceId,
  clientId,
}: EmailTimelineItemProps) {
  const [optimisticCategory, setOptimisticCategory] = useState<string | null>(
    null,
  );
  const [optimisticTriaged, setOptimisticTriaged] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [showRecategorize, setShowRecategorize] = useState(false);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const currentCategory = optimisticCategory ?? email.category;
  const config = currentCategory ? CATEGORY_CONFIG[currentCategory] : null;

  // AC5: show triage controls only when email requires human confirmation
  const isPendingTriage = !optimisticTriaged && email.requiresConfirmation;

  const handleAction = async (newCategory: string) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setOptimisticCategory(newCategory);
    setOptimisticTriaged(true);
    setShowRecategorize(false);
    setIsPending(true);
    try {
      const result = await recategorizeTimelineEmail({
        emailId: email.id,
        category: newCategory,
        workspaceId,
        clientId,
      });
      if (!result.success) {
        setOptimisticCategory(null);
        setOptimisticTriaged(false);
      }
    } catch (e) {
      setOptimisticCategory(null);
      setOptimisticTriaged(false);
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) {
        setIsPending(false);
      }
    }
  };

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white ring-4 ring-slate-50 shadow-sm">
          <Mail className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 w-px bg-slate-200 group-last:bg-transparent mt-1" />
      </div>

      <div className="flex-1 pb-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-500">
            {formatRelativeTime(new Date(email.receivedAt))}
          </span>
          {config ? (
            <Badge variant={config.variant}>{config.label}</Badge>
          ) : (
            <Badge variant="secondary">Pending</Badge>
          )}
        </div>

        {/* AC6 deferred: remove cursor-pointer until detail pane is implemented */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h4 className="font-semibold text-slate-900 mb-1 truncate">
            {email.subject || '(No Subject)'}
          </h4>
          <p className="text-sm text-slate-600 mb-4 truncate">
            {email.fromAddress}
          </p>

          {isPendingTriage && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700 h-8 px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(email.category ?? 'action');
                }}
                disabled={isPending}
              >
                <Check className="h-3.5 w-3.5 mr-1" />{' '}
                {email.category ? 'Approve' : 'Approve as Action'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('noise');
                }}
                disabled={isPending}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-slate-400 hover:text-slate-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRecategorize((v) => !v);
                }}
                disabled={isPending}
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Recategorize
              </Button>

              {showRecategorize && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100 w-full">
                  {CATEGORIES.map((cat) => (
                    <Button
                      key={cat}
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (cat !== currentCategory) handleAction(cat);
                      }}
                      disabled={isPending || cat === currentCategory}
                      className="h-7 px-2 text-xs capitalize"
                    >
                      {CATEGORY_CONFIG[cat]?.label ?? cat}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

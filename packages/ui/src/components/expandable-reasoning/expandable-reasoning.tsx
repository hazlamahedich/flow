'use client';

import { useState } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableReasoningProps {
  reasoning: string;
  className?: string;
}

export function ExpandableReasoning({
  reasoning,
  className,
}: ExpandableReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn('mt-3', className)}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--flow-text-tertiary)] hover:text-[var(--flow-text-secondary)] transition-colors mb-2"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            Hide reasoning
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            Why?
          </>
        )}
      </button>

      {isExpanded && (
        <div className="rounded-[var(--flow-radius-md)] bg-[var(--flow-bg-surface-raised)] p-3 text-sm text-[var(--flow-text-secondary)] animate-in slide-in-from-top-2 duration-200">
          <p className="font-medium text-[var(--flow-text-primary)] mb-1 text-xs uppercase tracking-wider">
            Agent Reasoning
          </p>
          <p className="leading-relaxed">{reasoning}</p>
        </div>
      )}
    </div>
  );
}

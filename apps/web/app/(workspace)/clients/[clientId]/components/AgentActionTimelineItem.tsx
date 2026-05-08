'use client';

import { AgentRunTimelineEntry } from '@flow/types';
import { Badge, ExpandableReasoning } from '@flow/ui';
import { Bot, ExternalLink, Activity } from 'lucide-react';
import Link from 'next/link';
import { AGENT_IDENTITY } from '@flow/shared';

interface AgentActionTimelineItemProps {
  run: AgentRunTimelineEntry;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'error' | 'warning' | 'secondary' | 'default' }> = {
  running: { label: 'Running', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  failed: { label: 'Failed', variant: 'error' },
  pending_approval: { label: 'Pending Approval', variant: 'default' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

function formatRelativeTime(date: Date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AgentActionTimelineItem({ run }: AgentActionTimelineItemProps) {
  const identity = AGENT_IDENTITY[run.agentId as keyof typeof AGENT_IDENTITY];
  const config = STATUS_CONFIG[run.status] || { label: run.status, variant: 'secondary' };
  
  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center">
        <div 
          className="h-8 w-8 rounded-full flex items-center justify-center border-2 border-white ring-4 ring-slate-50"
          style={{ backgroundColor: identity ? `${identity.color}20` : '#f1f5f9' }}
        >
          <Bot 
            className="h-4 w-4" 
            style={{ color: identity?.color || '#64748b' }}
          />
        </div>
        <div className="flex-1 w-px bg-slate-200 group-last:bg-transparent mt-1" />
      </div>
      
      <div className="flex-1 pb-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-500">
            {formatRelativeTime(new Date(run.createdAt))}
          </span>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-slate-900">{identity?.label || run.agentId} Agent</h4>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {run.actionType}
            </span>
          </div>

          {run.status === 'pending_approval' && run.proposal && (
            <div className="mt-3">
              <p className="text-sm text-slate-600 mb-3">{run.proposal.content}</p>
              
              <ExpandableReasoning reasoning={run.proposal.reasoning} />
              
              <Link
                href={`/agents/approvals?runId=${run.id}`}
                data-testid="timeline-proposal-link"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors mt-4"
              >
                View in Approvals <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
          
          {run.status !== 'pending_approval' && (
            <p className="text-sm text-slate-500 italic">
              Agent execution {config.label.toLowerCase()}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { ApprovalQueueItem } from '@flow/types';
import { parseApprovalOutputWithRun } from '@flow/types';

interface UseApprovalRealtimeOptions {
  workspaceId: string;
  onNewItem: (item: ApprovalQueueItem) => void;
}

export function useApprovalRealtime({ workspaceId, onNewItem }: UseApprovalRealtimeOptions) {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    );

    const channel = supabase
      .channel('approval-queue')
      .on(
        'postgres_changes' as Parameters<typeof supabase.channel>[0] extends string ? 'postgres_changes' : never,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_runs',
          filter: 'status=eq.waiting_approval',
        },
        (payload: { new: Record<string, unknown> }) => {
          const raw = payload.new;
          if (!raw || raw.status !== 'waiting_approval') return;
          if (raw.workspace_id !== workspaceId) return;
          const run = {
            id: raw.id as string,
            workspaceId: raw.workspace_id as string,
            agentId: raw.agent_id as import('@flow/types').AgentId,
            jobId: raw.job_id as string,
            signalId: null,
            actionType: raw.action_type as string,
            clientId: null,
            idempotencyKey: null,
            status: 'waiting_approval' as const,
            input: raw.input as Record<string, unknown>,
            output: raw.output as Record<string, unknown> | null,
            error: null,
            trustTierAtExecution: null,
            trustSnapshotId: null,
            correlationId: raw.correlation_id as string,
            startedAt: null,
            completedAt: null,
            createdAt: raw.created_at as string,
            updatedAt: raw.updated_at as string,
          };
          const item = parseApprovalOutputWithRun(run.output, run);
          if (item) {
            onNewItem(item);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, onNewItem]);
}

'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '../supabase-server';
import { performUndo, checkOptimisticLock } from '@flow/db/queries/undo/undo-helpers';
import type { ActionResult } from '@flow/types';

const processedOperationIds = new Map<string, { data: Record<string, unknown>; timestamp: number }>();

const CLEANUP_THRESHOLD = 1000;
const ENTRY_TTL_MS = 60_000;

function cleanupProcessedIds() {
  if (processedOperationIds.size < CLEANUP_THRESHOLD) return;
  const cutoff = Date.now() - ENTRY_TTL_MS;
  for (const [key, value] of processedOperationIds) {
    if (value.timestamp < cutoff) {
      processedOperationIds.delete(key);
    }
  }
}

export interface UndoActionInput {
  operationId: string;
  entityType: string;
  entityId: string;
  expectedVersion: number;
  previousSnapshot: Record<string, unknown>;
}

export async function undoAction(
  input: UndoActionInput,
): Promise<ActionResult<Record<string, unknown>>> {
  cleanupProcessedIds();

  const supabase = await getServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      success: false,
      error: {
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
        category: 'auth',
      },
    };
  }

  const idempotencyKey = `${user.id}:${input.operationId}`;
  const existing = processedOperationIds.get(idempotencyKey);
  if (existing) {
    return { success: true, data: existing.data };
  }

  const tableMap: Record<string, string> = {
    client: 'clients',
    invoice: 'invoices',
  };

  const table = tableMap[input.entityType];
  if (!table) {
    return {
      success: false,
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: `Unknown entity type: ${input.entityType}`,
        category: 'validation',
      },
    };
  }

  const lockResult = await checkOptimisticLock(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase as any,
    table,
    input.entityId,
    input.expectedVersion,
  );

  if (!lockResult.success) {
    if (lockResult.conflict) {
      return {
        success: false,
        error: {
          status: 409,
          code: 'CONFLICT',
          message: 'Entity was modified by another user. Conflict resolution required.',
          category: 'system',
          details: {
            expectedVersion: lockResult.conflict.expectedVersion,
            actualVersion: lockResult.conflict.actualVersion,
            currentData: lockResult.conflict.currentData,
          },
        },
      };
    }
    return {
      success: false,
      error: lockResult.error ?? {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Unknown error during optimistic lock check',
        category: 'system',
      },
    };
  }

  const undoResult = await performUndo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase as any,
    table,
    input.entityId,
    input.previousSnapshot,
    input.expectedVersion,
  );

  if (!undoResult.success) {
    if (undoResult.conflict) {
      return {
        success: false,
        error: {
          status: 409,
          code: 'CONFLICT',
          message: 'Entity was modified during undo. Please resolve the conflict.',
          category: 'system',
          details: {
            expectedVersion: undoResult.conflict.expectedVersion,
            actualVersion: undoResult.conflict.actualVersion,
            currentData: undoResult.conflict.currentData,
          },
        },
      };
    }
    return {
      success: false,
      error: undoResult.error ?? {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Unknown error during undo',
        category: 'system',
      },
    };
  }

  const resultData = (undoResult.data ?? {}) as Record<string, unknown>;
  processedOperationIds.set(idempotencyKey, {
    data: resultData,
    timestamp: Date.now(),
  });

  revalidateTag(`${input.entityType}-${input.entityId}`);

  return { success: true, data: resultData };
}

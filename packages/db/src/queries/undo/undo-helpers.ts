import type { FlowError } from '@flow/types';
import type { UndoActionSeverity } from '@flow/shared';

export interface UndoPayload {
  operationId: string;
  entityType: string;
  entityId: string;
  previousSnapshot: Record<string, unknown>;
  expectedVersion: number;
  severity: UndoActionSeverity;
  irreversible: boolean;
  description: string;
}

export function buildUndoPayload(
  entityType: string,
  entityId: string,
  previousState: Record<string, unknown>,
  operationId: string,
  version: number,
  severity: UndoActionSeverity = 'whisper',
  irreversible = false,
  description = '',
): UndoPayload {
  return {
    operationId,
    entityType,
    entityId,
    previousSnapshot: previousState,
    expectedVersion: version,
    severity,
    irreversible,
    description,
  };
}

export interface OptimisticLockResult {
  success: boolean;
  data?: Record<string, unknown>;
  conflict?: {
    expectedVersion: number;
    actualVersion: number;
    currentData: Record<string, unknown>;
  };
  error?: FlowError;
}

interface SupabaseSelectSingle {
  single: () => Promise<{
    data: Record<string, unknown> | null;
    error: { code: string; message: string } | null;
  }>;
}

interface SupabaseSelectChain {
  select: (cols: string) => { eq: (col: string, val: string) => SupabaseSelectSingle };
}

interface SupabaseFromSelect {
  from: (table: string) => SupabaseSelectChain;
}

interface SupabaseUpdateResult {
  data: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
}

interface SupabaseUpdateChain {
  update: (data: Record<string, unknown>) => {
    eq: (col: string, val: string) => {
      eq: (col2: string, val: number) => Promise<SupabaseUpdateResult>;
    };
  };
}

interface SupabaseFromUpdate {
  from: (table: string) => SupabaseUpdateChain;
}

export async function checkOptimisticLock(
  client: SupabaseFromSelect,
  table: string,
  id: string,
  expectedVersion: number,
): Promise<OptimisticLockResult> {
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: {
          status: 404,
          code: 'NOT_FOUND',
          message: 'Record not found',
          category: 'system',
        },
      };
    }
    if (error.code === '42501' || error.message?.includes('policy')) {
      return {
        success: false,
        error: {
          status: 403,
          code: 'TENANT_MISMATCH',
          message: 'Access denied to this record',
          category: 'auth',
        },
      };
    }
    return {
      success: false,
      error: {
        status: 500,
        code: 'DATABASE_ERROR',
        message: error.message ?? 'Database error',
        category: 'system',
      },
    };
  }

  if (!data) {
    return {
      success: false,
      error: {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Record not found',
        category: 'system',
      },
    };
  }

  if ((data as Record<string, unknown>).version !== expectedVersion) {
    return {
      success: false,
      conflict: {
        expectedVersion,
        actualVersion: (data as Record<string, unknown>).version as number,
        currentData: data,
      },
    };
  }

  return { success: true, data };
}

export async function performUndo(
  client: SupabaseFromUpdate,
  table: string,
  id: string,
  previousSnapshot: Record<string, unknown>,
  expectedVersion: number,
): Promise<OptimisticLockResult> {
  const PROTECTED_SNAPSHOT_KEYS = new Set([
    'id', 'version', 'created_at', 'updated_at', 'workspace_id',
  ]);

  const restorable = Object.fromEntries(
    Object.entries(previousSnapshot).filter(([k]) => !PROTECTED_SNAPSHOT_KEYS.has(k)),
  );

  const { data, error } = await client
    .from(table)
    .update({ ...restorable, version: expectedVersion + 1 })
    .eq('id', id)
    .eq('version', expectedVersion);

  if (error) {
    return {
      success: false,
      error: {
        status: 409,
        code: 'CONFLICT',
        message: error.message,
        category: 'system',
      },
    };
  }

  if (!data) {
    return {
      success: false,
      conflict: {
        expectedVersion,
        actualVersion: expectedVersion + 1,
        currentData: {},
      },
    };
  }

  return { success: true, data };
}

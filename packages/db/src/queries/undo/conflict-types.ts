export interface DiffField {
  fieldName: string;
  fieldLabel: string;
  clientValue: unknown;
  serverValue: unknown;
}

export interface ConflictInfo {
  hasConflict: boolean;
  conflictingFields: DiffField[];
  autoMergedFields: Array<{
    fieldName: string;
    fieldLabel: string;
    value: unknown;
    source: 'client' | 'server';
  }>;
}

export type FieldResolution = 'keep_client' | 'keep_server';

export interface ConflictResolution {
  [fieldName: string]: FieldResolution;
}

export interface ConflictResult {
  resolvedData: Record<string, unknown>;
  version: number;
}

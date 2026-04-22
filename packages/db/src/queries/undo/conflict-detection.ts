import type { ConflictInfo, DiffField, ConflictResolution } from './conflict-types';

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj).sort();
  const bKeys = Object.keys(bObj).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, i) => key === bKeys[i] && deepEqual(aObj[key], bObj[key]));
}

export function detectConflict(
  expectedVersion: number,
  serverRecord: Record<string, unknown>,
): boolean {
  const serverVersion = serverRecord.version;
  if (serverVersion == null || typeof serverVersion !== 'number') return true;
  return serverVersion !== expectedVersion;
}

export function buildDiff(
  clientState: Record<string, unknown>,
  serverState: Record<string, unknown>,
  fieldLabels: Record<string, string>,
): ConflictInfo {
  const allKeys = new Set([
    ...Object.keys(clientState),
    ...Object.keys(serverState),
  ]);

  const skipKeys = new Set(['id', 'version', 'created_at', 'updated_at', 'workspace_id']);

  const conflictingFields: DiffField[] = [];
  const autoMergedFields: ConflictInfo['autoMergedFields'] = [];

  for (const key of allKeys) {
    if (skipKeys.has(key)) continue;

    const fieldLabel = fieldLabels[key] ?? key;
    const clientVal = clientState[key];
    const serverVal = serverState[key];

    if (clientVal === undefined && serverVal === undefined) continue;

    if (clientVal === undefined || serverVal === undefined) {
      autoMergedFields.push({
        fieldName: key,
        fieldLabel,
        value: clientVal ?? serverVal,
        source: clientVal !== undefined ? 'client' : 'server',
      });
      continue;
    }

    if (!deepEqual(clientVal, serverVal)) {
      conflictingFields.push({
        fieldName: key,
        fieldLabel,
        clientValue: clientVal,
        serverValue: serverVal,
      });
    }
  }

  return {
    hasConflict: conflictingFields.length > 0,
    conflictingFields,
    autoMergedFields,
  };
}

export function mergeNonConflicting(
  clientState: Record<string, unknown>,
  serverState: Record<string, unknown>,
  conflictInfo: ConflictInfo,
  resolution: ConflictResolution,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...serverState };

  for (const field of conflictInfo.autoMergedFields) {
    if (field.source === 'client') {
      merged[field.fieldName] = clientState[field.fieldName];
    }
  }

  for (const field of conflictInfo.conflictingFields) {
    const choice = resolution[field.fieldName] ?? 'keep_server';
    if (choice === 'keep_client') {
      merged[field.fieldName] = field.clientValue;
    }
  }

  return merged;
}

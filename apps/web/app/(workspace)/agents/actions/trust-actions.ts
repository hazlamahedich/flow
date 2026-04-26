'use server';

import { revalidateTag } from 'next/cache';
import type { ActionResult } from '@flow/types';
import {
  UpgradeTrustSchema,
  DowngradeTrustSchema,
  UndoRegressionSchema,
  AcknowledgeRegressionSchema,
} from './trust-schemas';
import {
  updateTrustMatrixEntry,
  insertTransition,
  acknowledgeTransition,
} from '@flow/db';
import { COOLDOWN_DAYS, MS_PER_DAY } from '@flow/trust';

export interface TrustTransitionResult {
  matrixEntryId: string;
  fromLevel: string;
  toLevel: string;
  version: number;
}

type TrustLevel = 'supervised' | 'confirm' | 'auto';

async function getTenantClient() {
  const { createServerClient, requireTenantContext } = await import('@flow/db');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const client = createServerClient({
    getAll: () => cookieStore.getAll().map((c: { name: string; value: string }) => ({ name: c.name, value: c.value })),
    set: () => {},
  });
  const ctx = await requireTenantContext(client);
  return { client, workspaceId: ctx.workspaceId, userId: ctx.userId };
}

const COOLDOWN_MS = COOLDOWN_DAYS * MS_PER_DAY;

function validationError(message: string): ActionResult<TrustTransitionResult> {
  return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message, category: 'validation' } };
}

function conflictError(message: string): ActionResult<TrustTransitionResult> {
  return { success: false, error: { status: 409, code: 'CONFLICT', message, category: 'system' } };
}

export async function upgradeTrustLevel(
  input: unknown,
): Promise<ActionResult<TrustTransitionResult>> {
  const parsed = UpgradeTrustSchema.safeParse(input);
  if (!parsed.success) return validationError('Invalid input');

  const { matrixEntryId, fromLevel, toLevel, expectedVersion } = parsed.data;
  const { client, workspaceId, userId } = await getTenantClient();

  const { data: owned } = await client
    .from('trust_matrix')
    .select('id')
    .eq('id', matrixEntryId)
    .eq('workspace_id', workspaceId)
    .single();
  if (!owned) return validationError('Trust entry not found in this workspace');

  try {
    const updated = await updateTrustMatrixEntry(matrixEntryId, {
      current_level: toLevel,
      cooldown_until: null,
    }, expectedVersion);

    await insertTransition({
      matrix_entry_id: matrixEntryId,
      workspace_id: workspaceId,
      from_level: fromLevel,
      to_level: toLevel,
      trigger_type: 'graduation',
      trigger_reason: `Graduated from ${fromLevel} to ${toLevel}`,
      is_context_shift: false,
      snapshot: { score: updated.score, version: updated.version },
      actor: `va:${userId}`,
    });

    revalidateTag('trust:' + workspaceId);
    return { success: true, data: { matrixEntryId, fromLevel, toLevel, version: updated.version } };
  } catch {
    return conflictError('This trust change was already processed');
  }
}

export async function downgradeTrustLevel(
  input: unknown,
): Promise<ActionResult<TrustTransitionResult>> {
  const parsed = DowngradeTrustSchema.safeParse(input);
  if (!parsed.success) return validationError('Invalid input');

  const { matrixEntryId, fromLevel, toLevel, expectedVersion, triggerType, triggerReason } = parsed.data;
  const { client, workspaceId, userId } = await getTenantClient();
  const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();

  const { data: owned } = await client
    .from('trust_matrix')
    .select('id')
    .eq('id', matrixEntryId)
    .eq('workspace_id', workspaceId)
    .single();
  if (!owned) return validationError('Trust entry not found in this workspace');

  try {
    const updated = await updateTrustMatrixEntry(matrixEntryId, {
      current_level: toLevel,
      cooldown_until: cooldownUntil,
    }, expectedVersion);

    await insertTransition({
      matrix_entry_id: matrixEntryId,
      workspace_id: workspaceId,
      from_level: fromLevel,
      to_level: toLevel,
      trigger_type: triggerType,
      trigger_reason: triggerReason,
      is_context_shift: false,
      snapshot: { score: updated.score, version: updated.version },
      actor: `va:${userId}`,
    });

    revalidateTag('trust:' + workspaceId);
    return { success: true, data: { matrixEntryId, fromLevel, toLevel, version: updated.version } };
  } catch {
    return conflictError('This trust change was already processed');
  }
}

export async function undoRegression(
  input: unknown,
): Promise<ActionResult<TrustTransitionResult>> {
  const parsed = UndoRegressionSchema.safeParse(input);
  if (!parsed.success) return validationError('Invalid input');

  const { transitionId, matrixEntryId, expectedVersion } = parsed.data;
  const { client, workspaceId, userId } = await getTenantClient();

  try {
    const { data: transition, error: transErr } = await client
      .from('trust_transitions')
      .select('from_level, to_level, trigger_type')
      .eq('id', transitionId)
      .eq('workspace_id', workspaceId)
      .single();
    if (transErr || !transition) {
      return validationError('Transition not found');
    }

    if (!['soft_violation', 'hard_violation'].includes(transition.trigger_type)) {
      return validationError('Only regression transitions can be undone');
    }

    const previousLevel = transition.from_level as TrustLevel;
    const currentLevel = transition.to_level as TrustLevel;

    const { data: entry, error: fetchErr } = await client
      .from('trust_matrix')
      .select('cooldown_until')
      .eq('id', matrixEntryId)
      .eq('workspace_id', workspaceId)
      .single();
    if (fetchErr || !entry) {
      return { success: false, error: { status: 404, code: 'NOT_FOUND', message: 'Trust entry not found', category: 'system' } };
    }

    const cooldownStr = entry.cooldown_until as string | null;
    if (cooldownStr) {
      const cooldownEnd = new Date(cooldownStr).getTime();
      if (Date.now() > cooldownEnd) {
        return validationError('Undo window has expired');
      }
    } else {
      return validationError('This regression has already been undone');
    }

    const updated = await updateTrustMatrixEntry(matrixEntryId, {
      current_level: previousLevel,
      cooldown_until: null,
    }, expectedVersion);

    await insertTransition({
      matrix_entry_id: matrixEntryId,
      workspace_id: workspaceId,
      from_level: currentLevel,
      to_level: previousLevel,
      trigger_type: 'manual_override',
      trigger_reason: 'Undo regression — restored previous level',
      is_context_shift: false,
      snapshot: { score: updated.score, version: updated.version, undone: true },
      actor: `va:${userId}`,
    });

    revalidateTag('trust:' + workspaceId);
    return { success: true, data: { matrixEntryId, fromLevel: currentLevel, toLevel: previousLevel, version: updated.version } };
  } catch {
    return conflictError('This trust change was already processed');
  }
}

export async function acknowledgeRegression(
  input: unknown,
): Promise<ActionResult<{ acknowledged: boolean }>> {
  const parsed = AcknowledgeRegressionSchema.safeParse(input);
  if (!parsed.success) return validationError('Invalid input');

  const { transitionId } = parsed.data;
  const { client, workspaceId } = await getTenantClient();

  const { data: owned } = await client
    .from('trust_transitions')
    .select('id')
    .eq('id', transitionId)
    .eq('workspace_id', workspaceId)
    .single();
  if (!owned) return validationError('Transition not found in this workspace');

  try {
    await acknowledgeTransition(workspaceId, transitionId);
    revalidateTag('trust:' + workspaceId);
    return { success: true, data: { acknowledged: true } };
  } catch {
    return { success: false, error: { status: 500, code: 'SERVER_ERROR', message: 'Failed to acknowledge', category: 'system' } };
  }
}

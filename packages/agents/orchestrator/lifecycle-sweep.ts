/**
 * Subscription lifecycle sweep workers (Story 9.5a — FR59).
 *
 * Two daily cron-driven sweeps:
 *   - `runGraceSweep()`     — `past_due` rows older than the grace window → `suspended`
 *   - `runSuspensionSweep()` — `suspended` rows older than the suspension window → `deleted`
 *
 * Both use the conditional-write RPC `transition_workspace_subscription_status`
 * (UPDATE ... WHERE id = $ws AND status = $expected RETURNING id) so a racing
 * webhook or reconciliation cannot clobber the row (Epic 8 retro #5).
 *
 * System-level: uses `createServiceClient()` (project-context.md:150). Reads
 * `app_config` directly — NOT `getTierConfig()` — because (a) the worker has no
 * React `cache()` need and (b) packages cannot import apps/web. Keys are seeded
 * by 9-3a migration `20260618000002` (grace=7, suspension=30).
 */
import { createServiceClient } from '@flow/db';
import { writeAuditLog } from '../shared/audit-writer';
import { GRACE_PERIOD_DAYS, SUSPENSION_MAX_DAYS } from '@flow/shared';

export interface SweepSummary {
  swept: number;
  failed: number;
  capped: boolean;
}

const SWEEP_BATCH_CAP = 500;

interface WorkspaceSweepRow {
  id: string;
  subscription_status: string;
  subscription_status_updated_at: string;
}

interface AppConfigRow {
  key: string;
  value: string;
}

/**
 * Reads a numeric config value from `app_config`. Falls back to `defaultValue`
 * on missing/error (EC8 — sweep must not crash if config is absent). Logs the
 * fallback so ops can spot a missing seed.
 */
async function fetchConfigDays(key: string, defaultValue: number): Promise<number> {
  try {
    const client = createServiceClient();
    const result = await client
      .from('app_config')
      .select('key, value')
      .eq('key', key)
      .maybeSingle();

    if (result.error) {
      throw new Error(result.error.message ?? 'query_error');
    }

    const row = result.data as AppConfigRow | null;
    if (!row?.value) {
      writeAuditLog({
        workspaceId: 'system',
        agentId: 'orchestrator',
        action: 'subscription.sweep_config_fallback',
        entityType: 'orchestrator',
        details: { key, defaultValue, reason: 'missing' },
      });
      return defaultValue;
    }

    const parsed = Number(row.value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      writeAuditLog({
        workspaceId: 'system',
        agentId: 'orchestrator',
        action: 'subscription.sweep_config_fallback',
        entityType: 'orchestrator',
        details: { key, defaultValue, reason: 'invalid', raw: row.value },
      });
      return defaultValue;
    }
    return parsed;
  } catch (err) {
    writeAuditLog({
      workspaceId: 'system',
      agentId: 'orchestrator',
      action: 'subscription.sweep_config_fallback',
      entityType: 'orchestrator',
      details: { key, defaultValue, error: String(err) },
    });
    return defaultValue;
  }
}

/**
 * Shared sweep core: queries rows past their window and conditionally
 * transitions them. Idempotency (project-context.md:494):
 *   - RPC returns `{ success: true }` → count toward `swept`, write audit log.
 *   - RPC returns `{ error: 'PRECONDITION_FAILED' }` → row already moved by a
 *     racing webhook/reconcile. Count toward `swept` (desired end-state is
 *     reached) but DO NOT write a second audit log.
 *   - RPC throws or returns other error → count toward `failed`, log per-row.
 */
async function runSweep(params: {
  fromStatus: 'past_due' | 'suspended';
  toStatus: 'suspended' | 'deleted';
  configKey: string;
  defaultDays: number;
  triggerLabel: 'grace_expired' | 'suspension_expired';
}): Promise<SweepSummary> {
  const days = await fetchConfigDays(params.configKey, params.defaultDays);

  const client = createServiceClient();
  const queryResult = await client
    .from('workspaces')
    .select('id, subscription_status, subscription_status_updated_at')
    .eq('subscription_status', params.fromStatus)
    .lt('subscription_status_updated_at', `now() - interval '${days} days'`)
    .order('subscription_status_updated_at', { ascending: true })
    .limit(SWEEP_BATCH_CAP);

  if (queryResult.error) {
    writeAuditLog({
      workspaceId: 'system',
      agentId: 'orchestrator',
      action: 'subscription.sweep_failed',
      entityType: 'orchestrator',
      details: {
        from: params.fromStatus,
        to: params.toStatus,
        error: String(queryResult.error),
      },
    });
    return { swept: 0, failed: 0, capped: false };
  }

  const rows = (queryResult.data as WorkspaceSweepRow[] | null) ?? [];
  const capped = rows.length >= SWEEP_BATCH_CAP;

  let swept = 0;
  let failed = 0;

  for (const row of rows) {
    const workspaceId = row.id;
    try {
      const rpcResult = await client.rpc('transition_workspace_subscription_status', {
        p_workspace_id: workspaceId,
        p_from_status: params.fromStatus,
        p_to_status: params.toStatus,
      });

      const data = (rpcResult.data ?? {}) as { success?: boolean; error?: string };
      if (rpcResult.error) {
        throw new Error(rpcResult.error.message ?? 'rpc_error');
      }
      if (data.error === 'PRECONDITION_FAILED') {
        swept += 1;
        continue;
      }
      if (data.success === true) {
        swept += 1;
        writeAuditLog({
          workspaceId,
          agentId: 'orchestrator',
          action: 'subscription.transitioned',
          entityType: 'workspace',
          entityId: workspaceId,
          details: {
            from: params.fromStatus,
            to: params.toStatus,
            trigger: params.triggerLabel,
          },
        });
        continue;
      }
      throw new Error(data.error ?? 'unknown_rpc_response');
    } catch (err) {
      failed += 1;
      writeAuditLog({
        workspaceId,
        agentId: 'orchestrator',
        action: 'subscription.sweep_failed',
        entityType: 'workspace',
        entityId: workspaceId,
        details: {
          from: params.fromStatus,
          to: params.toStatus,
          error: String(err),
        },
      });
    }
  }

  writeAuditLog({
    workspaceId: 'system',
    agentId: 'orchestrator',
    action: 'subscription.sweep_complete',
    entityType: 'orchestrator',
    details: {
      from: params.fromStatus,
      to: params.toStatus,
      swept,
      failed,
      capped,
      windowDays: days,
    },
  });

  return { swept, failed, capped };
}

/**
 * Grace sweep — `past_due` rows older than `subscription_grace_period_days`
 * (default 7) transition to `suspended`. Per AC3.
 */
export async function runGraceSweep(): Promise<SweepSummary> {
  return runSweep({
    fromStatus: 'past_due',
    toStatus: 'suspended',
    configKey: 'subscription_grace_period_days',
    defaultDays: GRACE_PERIOD_DAYS,
    triggerLabel: 'grace_expired',
  });
}

/**
 * Suspension sweep — `suspended` rows older than
 * `subscription_suspension_period_days` (default 30) transition to `deleted`.
 * `deleted` is a soft marker — actual row deletion + GDPR cascade is story 10-5.
 * Per AC4.
 */
export async function runSuspensionSweep(): Promise<SweepSummary> {
  return runSweep({
    fromStatus: 'suspended',
    toStatus: 'deleted',
    configKey: 'subscription_suspension_period_days',
    defaultDays: SUSPENSION_MAX_DAYS,
    triggerLabel: 'suspension_expired',
  });
}

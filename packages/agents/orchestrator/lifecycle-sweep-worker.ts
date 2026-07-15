/**
 * Lifecycle sweep worker registration (Story 9.5a — FR59).
 *
 * Sibling file to `sweep-worker.ts` (which is already 728 lines — over the
 * 200-line soft limit). Three `boss.work(...)` handlers, one per pg-boss
 * trigger registered in `scheduler.ts`:
 *
 *   - `subscription-grace-sweep-trigger`       → `runGraceSweep()`
 *   - `subscription-suspension-sweep-trigger`  → `runSuspensionSweep()`
 *   - `subscription-reconcile-trigger`         → `runReconciliation()`
 *
 * The triggers are sent by pg-boss cron (SCHEDULES array in scheduler.ts).
 * Each handler dynamically imports its action to keep this file thin.
 */
import type { PgBoss } from 'pg-boss';
import { writeAuditLog } from '../shared/audit-writer';

interface LifecycleTriggerPayload {
  type: 'sweep_trigger';
  trigger:
    | 'subscription_grace_daily'
    | 'subscription_suspension_daily'
    | 'subscription_reconcile_nightly';
}

/**
 * Registers a single lifecycle trigger handler. Extracted to avoid
 * duplication — each handler follows the same shape: dynamic-import its
 * action, invoke it, log the outcome.
 */
async function registerLifecycleTrigger(
  boss: PgBoss,
  queueName: string,
  importer: () => Promise<
    { default?: () => Promise<unknown> } | (() => Promise<unknown>)
  >,
  label: string,
): Promise<void> {
  await boss.work<LifecycleTriggerPayload>(queueName, async () => {
    try {
      const mod = await importer();
      const runner =
        typeof mod === 'function'
          ? mod
          : (mod.default as () => Promise<unknown>);
      const result = await runner();
      writeAuditLog({
        workspaceId: 'system',
        agentId: 'orchestrator',
        action: 'subscription.lifecycle_job_complete',
        entityType: 'orchestrator',
        details: { job: label, result: result as Record<string, unknown> },
      });
    } catch (err) {
      writeAuditLog({
        workspaceId: 'system',
        agentId: 'orchestrator',
        action: 'subscription.lifecycle_job_failed',
        entityType: 'orchestrator',
        details: { job: label, error: String(err) },
      });
      throw err;
    }
  });
}

/**
 * Entry point — called from `factory.ts` alongside `registerSweepWorkers`.
 * Registers all three lifecycle cron handlers.
 */
export async function registerLifecycleSweepWorkers(
  boss: PgBoss,
): Promise<void> {
  await registerLifecycleTrigger(
    boss,
    'subscription-grace-sweep-trigger',
    async () => {
      const mod = await import('./lifecycle-sweep');
      return { default: mod.runGraceSweep };
    },
    'subscription_grace_daily',
  );

  await registerLifecycleTrigger(
    boss,
    'subscription-suspension-sweep-trigger',
    async () => {
      const mod = await import('./lifecycle-sweep');
      return { default: mod.runSuspensionSweep };
    },
    'subscription_suspension_daily',
  );

  await registerLifecycleTrigger(
    boss,
    'subscription-reconcile-trigger',
    async () => {
      const mod = await import('./reconcile-subscriptions');
      return { default: mod.runReconciliation };
    },
    'subscription_reconcile_nightly',
  );
}

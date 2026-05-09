import type { PgBoss } from 'pg-boss';

let bossInstance: PgBoss | null = null;

export function setBossInstance(boss: PgBoss): void {
  bossInstance = boss;
}

export function getBossInstance(): PgBoss {
  if (!bossInstance) {
    throw new Error('[orchestrator] PgBoss instance not initialized. Call setBossInstance() during startup.');
  }
  return bossInstance;
}

export function clearBossInstance(): void {
  bossInstance = null;
}

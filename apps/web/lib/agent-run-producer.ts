import { PgBoss } from 'pg-boss';
import { PgBossProducer } from '@flow/agents/orchestrator/pg-boss-producer';
import type { AgentRunProducer } from '@flow/agents/orchestrator/types';

let producerInstance: AgentRunProducer | null = null;

export async function getServerAgentRunProducer(): Promise<AgentRunProducer> {
  if (producerInstance) return producerInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for agent run producer');
  }

  const boss = new PgBoss({
    connectionString,
    schema: 'pgboss',
    migrate: true,
    max: 3,
  });

  await boss.start();
  producerInstance = new PgBossProducer(boss);
  return producerInstance;
}

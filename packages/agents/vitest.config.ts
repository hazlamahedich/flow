import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
  },
  resolve: {
    alias: {
      '@flow/types': path.resolve(__dirname, '../types/src/index.ts'),
      '@flow/db': path.resolve(__dirname, '../db/src/index.ts'),
      '@flow/agents': path.resolve(__dirname, 'index.ts'),
      '@flow/agents/orchestrator/transition-map': path.resolve(__dirname, 'orchestrator/transition-map.ts'),
      '@flow/agents/orchestrator/types': path.resolve(__dirname, 'orchestrator/types.ts'),
      '@flow/db/schema/agent-runs': path.resolve(__dirname, '../db/src/schema/agent-runs.ts'),
      '@flow/db/schema/agent-signals': path.resolve(__dirname, '../db/src/schema/agent-signals.ts'),
    },
  },
});

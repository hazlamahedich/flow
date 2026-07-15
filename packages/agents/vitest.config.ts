import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@flow/types': path.resolve(__dirname, '../types/src'),
      '@flow/db': path.resolve(__dirname, '../db/src'),
      '@flow/shared': path.resolve(__dirname, '../shared/src'),
      '@flow/agents': path.resolve(__dirname, '.'),
    },
  },
});

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    dangerouslyIgnoreUnhandledErrors: true,
  },
  resolve: {
    alias: {
      '@flow/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@flow/db/queries/undo/conflict-detection': path.resolve(__dirname, '../db/src/queries/undo/conflict-detection.ts'),
      '@flow/db/queries/undo/conflict-types': path.resolve(__dirname, '../db/src/queries/undo/conflict-types.ts'),
      '@flow/types': path.resolve(__dirname, '../types/src/index.ts'),
    },
  },
});

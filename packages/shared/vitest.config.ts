import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
  },
  resolve: {
    alias: {
      '@flow/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});

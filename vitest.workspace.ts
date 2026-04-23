import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@flow/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@flow/tokens': path.resolve(__dirname, 'packages/tokens/src/index.ts'),
      '@flow/ui': path.resolve(__dirname, 'packages/ui/src/index.ts'),
      '@flow/types': path.resolve(__dirname, 'packages/types/src/index.ts'),
      '@flow/db': path.resolve(__dirname, 'packages/db/src/index.ts'),
      '@flow/auth': path.resolve(__dirname, 'packages/auth/src/index.ts'),
      '@flow/auth/device-trust': path.resolve(__dirname, 'packages/auth/src/device-trust.ts'),
      '@flow/auth/device-types': path.resolve(__dirname, 'packages/auth/src/device-types.ts'),
      '@flow/agents': path.resolve(__dirname, 'packages/agents/index.ts'),
    },
  },
});

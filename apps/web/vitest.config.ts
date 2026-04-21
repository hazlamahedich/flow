import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app'),
      '@flow/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@flow/db/client': path.resolve(__dirname, '../../packages/db/src/client.ts'),
      '@flow/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@flow/tokens': path.resolve(__dirname, '../../packages/tokens/src/index.ts'),
      '@flow/tokens/providers': path.resolve(__dirname, '../../packages/tokens/src/providers/theme-provider.tsx'),
      '@flow/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@flow/auth': path.resolve(__dirname, '../../packages/auth/src/index.ts'),
      '@flow/auth/device-trust': path.resolve(__dirname, '../../packages/auth/src/device-trust.ts'),
      '@flow/auth/device-types': path.resolve(__dirname, '../../packages/auth/src/device-types.ts'),
      '@flow/auth/server-admin': path.resolve(__dirname, '../../packages/auth/src/server-admin.ts'),
      '@flow/auth/env': path.resolve(__dirname, '../../packages/auth/src/env.ts'),
    },
  },
});

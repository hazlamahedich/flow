import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*', 'e2e/**'],
  },
  resolve: {
    alias: [
      { find: /^@flow\/db\/queries\/undo\/undo-helpers$/, replacement: path.resolve(__dirname, '../../packages/db/src/queries/undo/undo-helpers.ts') },
      { find: '@flow/db/client', replacement: path.resolve(__dirname, '../../packages/db/src/client.ts') },
      { find: /^@flow\/db$/, replacement: path.resolve(__dirname, '../../packages/db/src/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, '.') },
      { find: '@flow/types', replacement: path.resolve(__dirname, '../../packages/types/src/index.ts') },
      { find: '@flow/tokens/providers', replacement: path.resolve(__dirname, '../../packages/tokens/src/providers/theme-provider.tsx') },
      { find: '@flow/tokens', replacement: path.resolve(__dirname, '../../packages/tokens/src/index.ts') },
      { find: '@flow/ui', replacement: path.resolve(__dirname, '../../packages/ui/src/index.ts') },
      { find: '@flow/auth/device-trust', replacement: path.resolve(__dirname, '../../packages/auth/src/device-trust.ts') },
      { find: '@flow/auth/device-types', replacement: path.resolve(__dirname, '../../packages/auth/src/device-types.ts') },
      { find: '@flow/auth/server-admin', replacement: path.resolve(__dirname, '../../packages/auth/src/server-admin.ts') },
      { find: '@flow/auth/env', replacement: path.resolve(__dirname, '../../packages/auth/src/env.ts') },
      { find: /^@flow\/auth$/, replacement: path.resolve(__dirname, '../../packages/auth/src/index.ts') },
      { find: '@flow/test-utils', replacement: path.resolve(__dirname, '../../packages/test-utils/src/index.ts') },
    ],
  },
});

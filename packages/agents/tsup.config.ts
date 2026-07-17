import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'index.ts',
    'providers/index.ts',
    'inbox/index.ts',
    'inbox/schemas/index.ts',
    'weekly-report/index.ts',
    'client-health/index.ts',
  ],
  format: ['esm'],
  dts: { only: false },
  clean: true,
  splitting: true,
  treeshake: true,
});

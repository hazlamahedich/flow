import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts', 'providers/index.ts', 'inbox/index.ts', 'inbox/initial-sync.ts', 'weekly-report/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});

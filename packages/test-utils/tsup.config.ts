import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/db/index.ts', 'src/core/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});

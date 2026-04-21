import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/server-admin.ts', 'src/env.ts', 'src/device-trust.ts', 'src/device-types.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});

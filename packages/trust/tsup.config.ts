import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
  },
  {
    entry: ['src/client/trust-client.ts'],
    format: ['esm'],
    dts: true,
  },
]);

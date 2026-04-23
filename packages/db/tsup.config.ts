import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client.ts',
    'src/queries/undo/conflict-detection.ts',
    'src/queries/undo/conflict-types.ts',
    'src/queries/undo/undo-helpers.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/hooks/use-theme.ts', 'src/providers/theme-provider.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom'],
});

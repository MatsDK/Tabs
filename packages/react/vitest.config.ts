import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      // Test against core's source directly (matching tsconfig's own path
      // mapping), not its built dist/ — tests shouldn't depend on a sibling
      // package having been built first.
      '@react-tabstack/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
});

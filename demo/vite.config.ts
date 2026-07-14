import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@react-tabstack/react': resolve(__dirname, '../packages/react/src/index.ts'),
      '@react-tabstack/core': resolve(__dirname, '../packages/core/src/index.ts'),
    },
  },
});

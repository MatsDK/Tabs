import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // Relative asset paths — works unmodified whether this ends up served from
  // a domain root (Vercel/Cloudflare/custom domain) or a subpath (GitHub
  // Pages project sites are served from /<repo>/, not /). The app only ever
  // does hash-based navigation (see App.tsx), never history-API path
  // routing, so there's no basename to keep in sync with this separately.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@react-tabstack/react': resolve(__dirname, '../packages/react/src/index.ts'),
      '@react-tabstack/core': resolve(__dirname, '../packages/core/src/index.ts'),
    },
  },
});

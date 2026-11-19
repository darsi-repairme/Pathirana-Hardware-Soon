import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  server: { host: 'localhost' },
});

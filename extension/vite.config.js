import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    // Dev-server-only — never consulted during `vite build`, so this has no
    // effect on the real bundled extension. Lets the preview pages (see
    // extension/preview.html) hit real production data as same-origin
    // requests, sidestepping the EBS's CORS allowlist (which only permits
    // *.ext-twitch.tv / PANEL_ORIGIN, not localhost) entirely — the browser
    // only ever talks to localhost:5173; this proxy forwards server-side.
    proxy: {
      '/preview-api': {
        target: 'https://livestreamerhub.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/preview-api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'index.html'),
        config: resolve(__dirname, 'config.html'),
        mobile: resolve(__dirname, 'mobile.html'),
        component: resolve(__dirname, 'component.html'),
      },
    },
  },
});

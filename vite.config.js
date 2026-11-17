import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Public settings baked into the browser bundle at build time. Neither is secret.
// Read without the VITE_ prefix so they can be set the same way on Vercel and GitHub Actions.
const env = (...keys) => keys.map((k) => process.env[k]).find(Boolean) || '';
const NEON_AUTH_URL = env('NEON_AUTH_URL', 'NEON_AUTH_BASE_URL', 'VITE_NEON_AUTH_URL');
// Where the API lives. Empty = same site (the Vercel build). Set it for the GitHub Pages build.
const API_URL = env('API_URL', 'VITE_API_URL').replace(/\/+$/, '');

// Relative base so the build works at any path (GitHub Pages subfolder, root, file server).
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    'import.meta.env.NEON_AUTH_URL': JSON.stringify(NEON_AUTH_URL),
    'import.meta.env.API_URL': JSON.stringify(API_URL),
  },
  build: {
    rollupOptions: {
      output: {
        // React rarely changes between releases, so it gets its own file. Its name (a hash of its contents)
        // stays the same after an app update, so returning visitors keep their cached copy and only
        // download the app code that actually changed.
        manualChunks: (id) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined),
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = process.env.API_PORT || 3001;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The browser only ever talks to Vite; /api calls are forwarded to Express.
    proxy: { '/api': `http://localhost:${API_PORT}` },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: './', // works at any sub-path, e.g. GitHub Pages /momentum/
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          db: ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
});

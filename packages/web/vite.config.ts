import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'https://uzavita-api-production.up.railway.app',
        changeOrigin: true,
        secure: false,
      },
      '/graphql': {
        target: 'https://uzavita-api-production.up.railway.app',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts', 'd3'],
          maps: ['maplibre-gl'],
          ui: ['framer-motion', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          state: ['zustand', '@tanstack/react-query'],
        },
      },
    },
  },
});

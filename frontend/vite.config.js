import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // El front llama a /api/... y Vite lo reenvia al backend
      '/api': 'http://localhost:3000',
    },
  },
});

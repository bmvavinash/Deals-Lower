import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_PRIMARY_API_URL': JSON.stringify(process.env.PRIMARY_API_URL || env.VITE_PRIMARY_API_URL || ''),
      'import.meta.env.VITE_FALLBACK_API_URL': JSON.stringify(process.env.FALLBACK_API_URL || env.VITE_FALLBACK_API_URL || '')
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3003',
          changeOrigin: true
        }
      }
    }
  };
});

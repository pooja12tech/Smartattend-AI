import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(() => {
  const isHttps = process.env.HTTPS === 'true';
  return {
    plugins: [
      react(),
      ...(isHttps ? [basicSsl()] : [])
    ],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        }
      }
    }
  };
});

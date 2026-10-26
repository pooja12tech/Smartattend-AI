import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
import path from 'path';

function pwaVersionPlugin() {
  const buildVersion = `b${Date.now().toString(36)}`;
  const devVersion = `dev-${Date.now().toString(36)}`;
  return {
    name: 'pwa-version-injector',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sw.js') {
          const swPath = path.resolve(__dirname, 'public/sw.js');
          if (fs.existsSync(swPath)) {
            let content = fs.readFileSync(swPath, 'utf-8');
            content = content.replace(/__SW_BUILD_VERSION__/g, devVersion);
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-cache');
            return res.end(content);
          }
        }
        if (req.url && req.url.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        next();
      });
    },
    closeBundle() {
      const distSw = path.resolve(__dirname, 'dist/sw.js');
      if (fs.existsSync(distSw)) {
        let content = fs.readFileSync(distSw, 'utf-8');
        content = content.replace(/__SW_BUILD_VERSION__/g, buildVersion);
        fs.writeFileSync(distSw, content, 'utf-8');
        console.log(`[PWA] Injected build version ${buildVersion} into dist/sw.js`);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), basicSsl(), pwaVersionPlugin()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    port: 4173,
    host: true
  }
});

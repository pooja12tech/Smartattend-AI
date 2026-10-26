// SmartAttend-AI Production Progressive Web App Service Worker
// Multi-Tier Caching, Network-First App Shell & MediaPipe Model Offline Resilience

const BUILD_ID = '__SW_BUILD_VERSION__';
const VERSION = (typeof BUILD_ID === 'string' && !BUILD_ID.startsWith('__')) ? BUILD_ID : 'v2.2.0';

const CACHE_APP = `smartattend-app-${VERSION}`;
const CACHE_ASSETS = `smartattend-assets-${VERSION}`;
const CACHE_MODELS = 'smartattend-mediapipe-v1'; // Shared across minor builds to avoid re-downloading 17MB on UI updates
const CACHE_FONTS = 'smartattend-fonts-v1';

const CORE_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/smartattend_logo.png',
  '/smartattend-ai-logo.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png'
];

// Offline HTML fallback for fresh navigations when network fails and index.html wasn't cached
const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>SmartAttend-AI &bull; Offline</title>
  <style>
    body { margin: 0; background-color: #020617; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; box-sizing: border-box; }
    .card { background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    h1 { font-size: 20px; font-weight: 800; margin: 0 0 12px; color: #e2e8f0; }
    p { font-size: 13px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px; }
    .btn { display: inline-block; background: #1A4731; color: #ffffff; padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 700; text-decoration: none; border: none; cursor: pointer; transition: background 0.2s; }
    .btn:hover { background: #4338ca; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(244, 63, 94, 0.15); color: #fb7185; font-size: 11px; font-weight: 700; margin-bottom: 16px; border: 1px solid rgba(244, 63, 94, 0.3); }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&bull; Network Disconnected</div>
    <h1>You are Currently Offline</h1>
    <p>SmartAttend-AI requires an active internet connection to securely sign in, verify cryptographic attendance tokens, and record biometrics.</p>
    <button class="btn" onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`;

// 1. Install Event: Pre-cache minimal essential app shell without blocking worker activation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_APP).then((cache) => {
      return cache.addAll(CORE_SHELL_URLS).catch((err) => {
        console.warn('[SW] Core shell pre-cache note:', err);
      });
    })
  );
  // Do NOT self.skipWaiting() here to avoid forcibly reloading in-progress attendance sessions.
});

// 2. Activate Event: Clean up outdated legacy caches, claim clients
self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_APP, CACHE_ASSETS, CACHE_MODELS, CACHE_FONTS];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!allowedCaches.includes(key)) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Message Event: Controlled skip-waiting requested by client update UI
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper: Network fetch with timeout
function fetchWithTimeout(request, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Network timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// 4. Fetch Event Handler
self.addEventListener('fetch', (event) => {
  // RULE 1: Handle GET requests only (never intercept POST, PUT, DELETE, etc.)
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // RULE 2: Backend API calls: Pure network (NEVER cache dynamic attendance/auth tokens)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            error: 'You are currently offline. Please reconnect to submit attendance.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // RULE 3: Navigations (HTML Documents)
  // Strategy: Network-first with 3s timeout, falling back to cached shell /index.html, then offline HTML
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetchWithTimeout(event.request, 3000)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_APP).then((c) => c.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then((cached) => cached || caches.match('/index.html'))
            .then((shell) => {
              if (shell) return shell;
              return new Response(OFFLINE_FALLBACK_HTML, {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              });
            });
        })
    );
    return;
  }

  // RULE 4: Hashed static bundle assets (/assets/*.js, /assets/*.css)
  // Strategy: Cache-first (Vite content-hashes guarantee cache immutability)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_ASSETS).then((c) => c.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // RULE 5: MediaPipe AI models & WebAssembly (/models/*, /wasm/*)
  // Strategy: Cache-first (warm cache after first load; enables offline eye-blink AI execution)
  if (url.pathname.startsWith('/models/') || url.pathname.startsWith('/wasm/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_MODELS).then((c) => c.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // RULE 6: Google Web Fonts (fonts.googleapis.com, fonts.gstatic.com)
  // Strategy: Stale-While-Revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const copy = networkResponse.clone();
            caches.open(CACHE_FONTS).then((c) => c.put(event.request, copy));
          }
          return networkResponse;
        }).catch(() => null);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // RULE 7: Generic static files (manifest.json, icons, favicon)
  // Strategy: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_APP).then((c) => c.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cached || fetchPromise;
    })
  );
});

// ============================================================================
// FUTURE PUSH NOTIFICATIONS & INTERACTION HANDLERS (Do not remove)
// Reserved for Web Push API integration in future releases.
// ============================================================================
/*
self.addEventListener('push', (event) => {
  // Push handler will be configured here
});

self.addEventListener('notificationclick', (event) => {
  // Notification interaction routing will be configured here
});
*/

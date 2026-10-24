// SmartAttend-AI PWA Service Worker Registration & Self-Healing Manager

let deferredInstallPrompt = null;
let swRegistration = null;
let updateAvailableCallback = null;

// Track whether user is actively inside an attendance flow to prevent disruptive reloads
export function setInAttendanceFlow(isActive) {
  if (typeof window !== 'undefined') {
    window.__SMARTATTEND_IN_ATTENDANCE__ = Boolean(isActive);
  }
}

export function isInAttendanceFlow() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__SMARTATTEND_IN_ATTENDANCE__);
}

// 1. Service Worker Registration
export function registerPwaServiceWorker(onUpdateAvailable) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  updateAvailableCallback = onUpdateAvailable;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        swRegistration = registration;

        // Check if there is already a waiting worker
        if (registration.waiting) {
          notifyUpdateAvailable(registration.waiting);
        }

        // Listen for new worker installing
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new update has been downloaded and is waiting
              notifyUpdateAvailable(installingWorker);
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration notice:', err);
      });
  });

  // When active controller changes (new worker took control):
  // Refresh page ONLY if not in attendance flow; otherwise defer
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;

    if (isInAttendanceFlow()) {
      console.warn('[PWA] Update activated, but deferring reload: student is currently in attendance flow.');
      // Add a one-time check when attendance flow finishes
      const checkInterval = setInterval(() => {
        if (!isInAttendanceFlow()) {
          clearInterval(checkInterval);
          window.location.reload();
        }
      }, 2000);
    } else {
      window.location.reload();
    }
  });

  // Setup hardened chunk recovery
  setupSelfHealing();
}

function notifyUpdateAvailable(worker) {
  if (typeof updateAvailableCallback === 'function') {
    updateAvailableCallback(worker);
  }
  window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { worker } }));
}

// User-triggered update
export function applyPwaUpdate() {
  if (swRegistration && swRegistration.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

// 2. Hardened Self-Healing Chunk Recovery
// Trigger ONLY on genuine dynamic module/chunk import errors, NEVER on generic "Failed to fetch" (API errors).
// Max 1 reload per session, and NEVER while student is in attendance flow.
function setupSelfHealing() {
  const isChunkError = (message) => {
    if (!message || typeof message !== 'string') return false;
    const lower = message.toLowerCase();
    return (
      lower.includes('dynamically imported module') ||
      lower.includes('failed to fetch dynamically imported module') ||
      lower.includes('error loading dynamically imported module') ||
      lower.includes('loading chunk') ||
      lower.includes('loading css chunk')
    );
  };

  const attemptChunkRecovery = (errorMsg) => {
    // 1. Guard against interrupting attendance
    if (isInAttendanceFlow()) {
      console.warn('[PWA] Suppressing chunk self-healing reload: active attendance flow in progress.');
      return;
    }

    // 2. Guard against infinite reload loops: max 1 attempt per session
    const RETRY_KEY = 'smartattend_chunk_retry_timestamp';
    const lastRetry = sessionStorage.getItem(RETRY_KEY);
    const now = Date.now();

    if (lastRetry && now - Number(lastRetry) < 60000) {
      console.warn('[PWA] Self-healing reload already executed within last 60s; skipping to avoid loop.');
      return;
    }

    sessionStorage.setItem(RETRY_KEY, String(now));
    console.warn('[PWA] Stale dynamic chunk detected. Purging asset caches and refreshing cleanly:', errorMsg);

    if ('caches' in window) {
      caches.keys().then((keys) => {
        // Purge app and assets caches
        return Promise.all(
          keys
            .filter((k) => k.includes('app') || k.includes('assets'))
            .map((k) => caches.delete(k))
        );
      }).then(() => {
        window.location.reload();
      }).catch(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  window.addEventListener('error', (event) => {
    if (event.error && isChunkError(event.error.message || event.message)) {
      attemptChunkRecovery(event.error.message || event.message);
    } else if (isChunkError(event.message)) {
      attemptChunkRecovery(event.message);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason && reason.message) || String(reason || '');
    if (isChunkError(msg)) {
      attemptChunkRecovery(msg);
    }
  });
}

// 3. Install Prompt Capture (beforeinstallprompt)
export function initInstallPromptListener() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-installable-changed', { detail: { installable: true } }));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installable-changed', { detail: { installable: false } }));
    console.log('[PWA] SmartAttend-AI installed successfully');
  });
}

export function isAppInstalled() {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = window.navigator.standalone === true;
  return isStandalone || isIosStandalone;
}

export function isInstallPromptAvailable() {
  return Boolean(deferredInstallPrompt);
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) {
    return { outcome: 'unavailable' };
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  window.dispatchEvent(new CustomEvent('pwa-installable-changed', { detail: { installable: false } }));

  promptEvent.prompt();
  const choiceResult = await promptEvent.userChoice;
  return choiceResult;
}

// 4. iOS Safari Detection
export function isIosSafari() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari && !isStandalone;
}

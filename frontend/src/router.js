/**
 * Clean Path-based Router (HTML5 History API)
 * Eliminates the legacy `#` hash from all URLs across Desktop & Mobile,
 * while automatically migrating any old bookmarkable `#/...` links to clean paths.
 */

export const getCleanPath = () => {
  if (typeof window === 'undefined') return '/';

  // 1. Automatic migration from legacy hash URLs (e.g. `/#/faculty/classes` -> `/faculty/classes`)
  const hash = window.location.hash || '';
  if (hash.startsWith('#/')) {
    const cleanFromHash = hash.slice(1); // remove '#'
    try {
      window.history.replaceState(null, '', cleanFromHash);
    } catch (_) {}
    return cleanFromHash;
  }

  return window.location.pathname || '/';
};

export const navigateToPath = (path) => {
  if (typeof window === 'undefined') return;
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== target) {
    try {
      window.history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (_) {
      window.location.href = target;
    }
  }
};

export const replacePath = (path) => {
  if (typeof window === 'undefined') return;
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== target) {
    try {
      window.history.replaceState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (_) {
      window.location.href = target;
    }
  }
};

export const parsePath = () => {
  const fullPath = getCleanPath();
  const segments = fullPath.split('?')[0].split('/').filter(Boolean);

  const role = segments[0] || null;
  const tab = segments[1] || null;

  return { fullPath, role, tab, segments };
};

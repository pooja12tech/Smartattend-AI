import { useState, useEffect } from 'react';

/**
 * Custom hook to subscribe to CSS media queries.
 * @param {string} query - CSS media query (e.g. '(min-width: 1024px)')
 * @returns {boolean} Whether the media query currently matches
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQueryList = window.matchMedia(query);
    const updateMatch = (e) => setMatches(e.matches);

    setMatches(mediaQueryList.matches);

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', updateMatch);
      return () => mediaQueryList.removeEventListener('change', updateMatch);
    } else {
      mediaQueryList.addListener(updateMatch);
      return () => mediaQueryList.removeListener(updateMatch);
    }
  }, [query]);

  return matches;
}

export default useMediaQuery;

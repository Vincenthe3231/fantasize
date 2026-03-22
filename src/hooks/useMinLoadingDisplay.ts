import { useEffect, useRef, useState } from 'react';

/**
 * Keeps `true` for at least `minMs` after `isLoading` first becomes true, even if `isLoading`
 * flips to false sooner — avoids a flash when workspace data resolves quickly.
 */
export function useMinLoadingDisplay(isLoading: boolean, minMs: number): boolean {
  const [displayLoading, setDisplayLoading] = useState(isLoading);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      shownAtRef.current = Date.now();
      setDisplayLoading(true);
      return;
    }

    const shownAt = shownAtRef.current;
    if (shownAt === null) {
      setDisplayLoading(false);
      return;
    }

    const elapsed = Date.now() - shownAt;
    const wait = Math.max(0, minMs - elapsed);
    const id = window.setTimeout(() => {
      setDisplayLoading(false);
      shownAtRef.current = null;
    }, wait);
    return () => window.clearTimeout(id);
  }, [isLoading, minMs]);

  return displayLoading;
}

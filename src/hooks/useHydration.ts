import { useLayoutEffect, useEffect, useState, type ReactNode } from 'react';

const isBrowser = typeof window !== 'undefined';

/**
 * useLayoutEffect is a no-op on the server and logs a warning if used there.
 * useEffect runs too late for “before paint” hydration alignment.
 */
const useIsoLayoutEffect = isBrowser ? useLayoutEffect : useEffect;

/**
 * `false` on the server and on the client’s first render (matches SSR HTML).
 * Flips to `true` in the same tick as the first layout commit (before paint),
 * so you avoid both hydration mismatches and visible flash when possible.
 *
 * Use for:
 * - Reading `localStorage` / `sessionStorage` in render
 * - `window.matchMedia`, `navigator`, random IDs, `Date.now()` in markup
 * - Branching UI that must match server HTML on first paint
 *
 * @example
 * const hydrated = useHydration();
 * const theme = hydrated ? localStorage.getItem('theme') : 'system';
 */
export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useIsoLayoutEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

/**
 * Server / first paint: `serverValue`. After hydration: `clientValue`.
 * Avoids prop/class/text drift between SSR and client.
 */
export function useHydratedValue<T>(serverValue: T, clientValue: T): T {
  const hydrated = useHydration();
  return hydrated ? clientValue : serverValue;
}

type HydrationGateProps = {
  /** Shown until the client has hydrated (should match SSR output). */
  fallback?: ReactNode;
  children: ReactNode;
};

/**
 * Renders `fallback` until hydrated, then `children`.
 * Default `fallback` is `null` — same on server and client first pass.
 */
export function HydrationGate({ fallback = null, children }: HydrationGateProps) {
  const hydrated = useHydration();
  if (!hydrated) return fallback;
  return children;
}

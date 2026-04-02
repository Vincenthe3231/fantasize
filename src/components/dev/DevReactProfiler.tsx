import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react';

const SLOW_MS = 16;

function readProfilerDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('vf.reactProfiler') === '0';
  } catch {
    return false;
  }
}

/**
 * Dev-only React Profiler. Logs commits when `actualDuration` ≥ 16ms.
 * Disable: `localStorage.setItem('vf.reactProfiler', '0')` — re-enable with `'1'` or remove the key.
 *
 * Route-level profiling intentionally lives only around heavy workspace UI (e.g. `vf-canvas-inner` in
 * `Index.tsx`), not `App`’s `<Routes>`, so canvas commits are not double-attributed to a shell id.
 */
export function DevReactProfiler({ id, children }: { id: string; children: ReactNode }) {
  if (!import.meta.env.DEV || readProfilerDisabled()) {
    return <>{children}</>;
  }

  const onRender: ProfilerOnRenderCallback = (
    profilerId,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    if (actualDuration < SLOW_MS) return;
    console.info(
      '[VF:react-profiler]',
      profilerId,
      phase,
      `${actualDuration.toFixed(1)}ms`,
      `(base ${baseDuration.toFixed(1)}ms)`,
      { startTime: Math.round(startTime), commitTime: Math.round(commitTime) }
    );
  };

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

/** Dev-only browser console logging for Scout pipeline (no secrets; truncated payloads). */

const MAX_STRING = 180;
const MAX_DEPTH = 5;
const MAX_ARRAY = 8;
const MAX_KEYS = 24;

function truncateStr(s: string): string {
  if (s.length <= MAX_STRING) return s;
  return `${s.slice(0, MAX_STRING)}… (${s.length} chars)`;
}

/** Safe clone for console: short strings, bounded depth, array length hints. */
export function summarizeForScoutLog(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '…';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncateStr(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const slice = value.slice(0, MAX_ARRAY).map((v) => summarizeForScoutLog(v, depth + 1));
    if (value.length > MAX_ARRAY) {
      return [...slice, `… +${value.length - MAX_ARRAY} items`];
    }
    return slice;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).slice(0, MAX_KEYS);
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = summarizeForScoutLog(o[k], depth + 1);
    }
    const total = Object.keys(o).length;
    if (total > MAX_KEYS) {
      out['…'] = `+${total - MAX_KEYS} more keys`;
    }
    return out;
  }
  return String(value);
}

function scoutDebugEnabled(): boolean {
  return Boolean(import.meta.env.DEV) && !import.meta.env.VITEST;
}

export function scoutDebugLog(label: string, payload?: unknown): void {
  if (!scoutDebugEnabled()) return;
  if (payload === undefined) {
    console.debug(`[Scout] ${label}`);
    return;
  }
  console.debug(`[Scout] ${label}`, summarizeForScoutLog(payload));
}

export function scoutDebugTime(label: string): () => void {
  if (!scoutDebugEnabled()) return () => {};
  const t0 = performance.now();
  return () => {
    const ms = Math.round(performance.now() - t0);
    console.debug(`[Scout] ${label} (${ms}ms)`);
  };
}

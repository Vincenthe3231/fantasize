/**
 * @openrouter/sdk throws `ResponseValidationError` with message "Response validation failed"
 * when the HTTP body does not match the generated Zod schema (streaming or JSON).
 * Surfaces `.pretty()` (Zod paths) for Edge logs and API error strings.
 */
export function formatOpenRouterSdkError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);

  const ex = e as Error & { pretty?: () => string; cause?: unknown };

  /** Bundled/minified builds may not preserve `name === 'ResponseValidationError'`. */
  if (typeof ex.pretty === 'function') {
    try {
      const p = ex.pretty();
      if (typeof p === 'string' && p.trim()) {
        return ex.message && ex.message !== p ? `${ex.message}: ${p}` : p;
      }
    } catch {
      /* fall through */
    }
  }

  if (ex.cause !== undefined && ex.cause !== null) {
    const inner = formatOpenRouterSdkError(ex.cause);
    if (inner && inner !== ex.message) return `${ex.message}: ${inner}`;
  }

  return ex.message;
}

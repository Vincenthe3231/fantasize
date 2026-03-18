/** Registered by the canvas when a space is active; used before sign-out. */
let flushFn: (() => Promise<void>) | null = null;

export function registerCanvasRemoteFlush(fn: () => Promise<void>): () => void {
  flushFn = fn;
  return () => {
    flushFn = null;
  };
}

export async function flushCanvasToRemote(): Promise<void> {
  await flushFn?.();
}

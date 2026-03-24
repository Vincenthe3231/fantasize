/** Minimal Deno env typing for editor/TS when not using Deno CLI in-repo */
declare const Deno: {
  env: { get(key: string): string | undefined };
};

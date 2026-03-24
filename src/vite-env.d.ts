/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set by Vitest; used to suppress dev-only Scout console logging during tests */
  readonly VITEST?: string;
}

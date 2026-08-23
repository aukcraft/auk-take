/**
 * Platform fingerprint, computed ONCE at module top level (spec: host-shell).
 * Business code must not probe the platform itself.
 */
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri: boolean =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

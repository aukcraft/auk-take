/**
 * Phase 4 contract types: the shared HTTP service (svc:http) and the
 * Jellyfin sync surface. Pure types — zero platform deps.
 */
import type { MovieRecord } from "@auktake/core";

/** Unified HTTP failure surfaced by svc:http consumers. */
export class HttpError extends Error {
  constructor(
    readonly kind: "timeout" | "network" | "status",
    readonly url: string,
    readonly status?: number,
  ) {
    super(`[http:${kind}] ${status ?? ""} ${url}`.trim());
    this.name = "HttpError";
  }
}

/** fetch-compatible signature with svc:http behavior (timeout/retry). */
export type HttpService = (url: string, init?: RequestInit) => Promise<Response>;

/** cmd:jellyfin-sync result. */
export type JellyfinSyncResult =
  | { readonly status: "imported"; readonly count: number }
  | { readonly status: "noop" }
  | { readonly status: "error"; readonly message: string };

export type JellyfinSyncCommand = () => Promise<JellyfinSyncResult>;

/** edit-side bulk import channel (records must be source.type=jellyfin). */
export type RecordApplyJellyfinCommand = (
  records: readonly MovieRecord[],
) => Promise<number>;

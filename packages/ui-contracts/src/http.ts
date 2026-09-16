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
    /** Underlying platform error message (e.g. "Network request failed"). */
    readonly detail?: string,
  ) {
    super(
      [`[http:${kind}]`, status ?? "", detail ?? "", url]
        .filter((p) => p !== "")
        .join(" "),
    );
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

/** Payload of JELLYFIN_EVENTS.syncProgress — emitted per fetched page. */
export interface JellyfinSyncProgress {
  /** 1-based page number of the oldest-first walk just fetched. */
  readonly page: number;
  /** Items fetched from the server so far in this run. */
  readonly fetched: number;
  /** New records actually imported so far in this run. */
  readonly imported: number;
}

/** edit-side bulk import channel (records must be source.type=jellyfin). */
export type RecordApplyJellyfinCommand = (
  records: readonly MovieRecord[],
) => Promise<number>;

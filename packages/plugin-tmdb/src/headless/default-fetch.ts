/**
 * The production fetch binding. init (headers!) MUST be forwarded —
 * a regression once dropped it, sending TMDB requests without the
 * Authorization header. Pinned by a regression test.
 */
import type { FetchLike } from "./tmdb-client";

export const defaultFetch: FetchLike = (url, init) => fetch(url, init);

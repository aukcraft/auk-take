/**
 * Phase 2 TMDB contract types: candidates returned by cmd:tmdb-search,
 * the backfill command surface, the image-pipeline helper, and the
 * image-cache service interface. Pure types/functions — zero platform
 * dependencies (spec: ui-contracts "契约类型零平台依赖").
 */

/** Search candidate from cmd:tmdb-search. */
export interface TmdbCandidate {
  readonly tmdbId: number;
  readonly mediaType: "movie" | "episode";
  /** Series title for episodes; the movie/episode title otherwise. */
  readonly title: string;
  readonly originalTitle: string;
  /** "YYYY-MM-DD" or "" when unknown. */
  readonly releaseDate: string;
  /** TMDB poster (movie) / still (episode) path, "" when absent. */
  readonly posterPath: string;
  readonly overview: string;
  /** Present for episode candidates (resolved series). */
  readonly tvId?: number;
}

/** Result of cmd:tmdb-backfill for a single record. */
export type TmdbBackfillResult =
  | { readonly status: "bound"; readonly recordId: string; readonly tmdbId: number }
  | { readonly status: "needs-review"; readonly recordId: string; readonly candidates: readonly TmdbCandidate[] }
  | { readonly status: "no-match"; readonly recordId: string }
  | { readonly status: "error"; readonly message: string };

/** TMDB image CDN base; size w500 is the card sweet spot. */
export function tmdbImageUrl(posterPath: string, size = "w500"): string | null {
  if (posterPath.length === 0) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

/**
 * Image pipeline consumed by renderers: full remote URL -> renderable
 * URI. Built by the composition root per platform (desktop resolves
 * through the local cache and returns an asset URI; mobile returns the
 * remote URL for direct fetch). null = unusable, fall back to color card.
 */
export type ImageUriResolver = (url: string) => Promise<string | null>;

/** svc:image-cache service contract (registered by plugin-tmdb). */
export interface ImageCacheService {
  /** Remote URL -> local cache file path (downloads on miss). null on failure. */
  resolve(url: string): Promise<string | null>;
  /** Drop all cached entries (capacity rebuild). */
  clear(): Promise<void>;
}

/** Resolve a picked search candidate into a full record snapshot. */
export type TmdbCandidateSnapshotCommand = (
  candidate: TmdbCandidate,
  episode?: { season: number; episode: number },
) => Promise<import("@auktake/core").TmdbSnapshot>;

/** tmdb backfill command surface. */
export type TmdbBackfillCommand = (recordId: string) => Promise<TmdbBackfillResult>;

/** Persisted tmdb plugin config (syncMeta collection, id "tmdb-config"). */
export interface TmdbConfig {
  /** Empty string = use the built-in default key. */
  readonly apiKey: string;
  /** BCP-47 tag; TMDB falls back to original language when absent. */
  readonly language: string;
}

export const DEFAULT_TMDB_CONFIG: TmdbConfig = { apiKey: "", language: "zh-CN" };

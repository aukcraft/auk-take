/**
 * Display selectors: pure functions over the records snapshot
 * (spec: plugin-display "自有数据投影" — derived data stays out of
 * components).
 */
import type { MovieRecord } from "@auktake/core";

/** Newest watchedAt first; stable tie-break by id. */
export function sortByWatchedAtDesc(records: readonly MovieRecord[]): MovieRecord[] {
  return [...records].sort((a, b) => {
    const byDate = b.user.watchedAt.localeCompare(a.user.watchedAt);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
}

/**
 * Poster resolution order (design D5): mediaCache.poster →
 * tmdb.posterPath → deterministic color card. Phase 1 always lands on
 * the palette branch, but the pipeline shape is already in place so
 * Phase 2 images plug in with zero structural change.
 */
export type PosterSource =
  | { readonly kind: "cache"; readonly path: string }
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "palette" };

export function resolvePosterSource(record: MovieRecord): PosterSource {
  if (record.mediaCache.poster && record.mediaCache.poster.length > 0) {
    return { kind: "cache", path: record.mediaCache.poster };
  }
  if (record.tmdb.posterPath.length > 0) {
    return { kind: "path", path: record.tmdb.posterPath };
  }
  return { kind: "palette" };
}

/** rating 0 = unrated: rendered explicitly, never as a zero score. */
export function ratingLabel(record: MovieRecord): string {
  return record.user.rating === 0 ? "未评分" : `${record.user.rating} 分`;
}

/** "S02E05" badge text for episodes; empty for movies. */
export function episodeBadge(record: MovieRecord): string {
  if (record.tmdb.mediaType !== "episode") return "";
  const s = String(record.tmdb.seasonNumber ?? 0).padStart(2, "0");
  const e = String(record.tmdb.episodeNumber ?? 0).padStart(2, "0");
  return `S${s}E${e}`;
}

/** Sync poster plan: what the card CAN resolve without async work. */
export interface PosterPlan {
  /** mediaCache.poster — already a renderable URI when present. */
  readonly cachedPoster: string | null;
  /** tmdb.posterPath — needs URL build + (optional) cache resolution. */
  readonly posterPath: string;
}

export function posterPlan(record: MovieRecord): PosterPlan {
  return {
    cachedPoster: record.mediaCache.poster && record.mediaCache.poster.length > 0
      ? record.mediaCache.poster
      : null,
    posterPath: record.tmdb.posterPath,
  };
}

/**
 * Async card source: cached URI -> image-cache-resolved URI -> remote
 * URL (direct) -> palette. Cache service optional (mobile/absent).
 * Pure headless — resolver injected, Node-testable.
 */
export async function resolveCardSource(
  record: MovieRecord,
  imageUrlFor: (posterPath: string) => string | null,
  imageCache?: { resolve(url: string): Promise<string | null> },
): Promise<
  | { readonly kind: "image"; readonly uri: string }
  | { readonly kind: "palette" }
> {
  const plan = posterPlan(record);
  if (plan.cachedPoster) return { kind: "image", uri: plan.cachedPoster };
  const url = imageUrlFor(plan.posterPath);
  if (url) {
    if (imageCache) {
      const local = await imageCache.resolve(url);
      if (local) return { kind: "image", uri: local };
    }
    return { kind: "image", uri: url }; // remote direct fallback
  }
  return { kind: "palette" };
}

/** Year text for the color card, from releaseDate when present. */
export function releaseYear(record: MovieRecord): string {
  const year = record.tmdb.releaseDate.slice(0, 4);
  return year.length === 4 && year !== "0000" ? year : "";
}

/**
 * Item -> MovieRecord mapping + identity key (design D2/D3).
 * Pure functions; fully matrix-tested.
 */
import { RECORD_SCHEMA_VERSION, type MovieRecord, type TmdbGenre } from "@auktake/core";
import type { JellyfinItem } from "./jellyfin-client";

const TICKS_PER_MINUTE = 600_000_000; // 1 tick = 100ns

/** ISO datetime -> "YYYY-MM-DD" (empty when absent). */
function dayOf(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export function itemIsEpisode(item: JellyfinItem): boolean {
  return item.Type === "Episode" || item.ParentIndexNumber !== undefined;
}

export function mapItemToRecord(
  item: JellyfinItem,
  generateId: () => string,
  nowIso: string,
): MovieRecord | null {
  const playedAt = dayOf(item.UserData?.LastPlayedDate);
  if (!item.Id || playedAt.length === 0) return null; // never played -> skip

  const episode = itemIsEpisode(item);
  const title = episode ? (item.SeriesName ?? item.Name ?? "") : (item.Name ?? "");
  const genres: readonly TmdbGenre[] = (item.Genres ?? []).map((name, i) => ({ id: -(i + 1), name }));

  return {
    id: generateId(),
    schemaVersion: RECORD_SCHEMA_VERSION,
    tmdb: {
      id: Number(item.ProviderIds?.Tmdb ?? 0),
      mediaType: episode ? "episode" : "movie",
      title,
      originalTitle: title,
      overview: item.Overview ?? "",
      posterPath: "",
      backdropPath: "",
      releaseDate: dayOf(item.PremiereDate),
      genres,
      runtime: Math.round((item.RuntimeTicks ?? 0) / TICKS_PER_MINUTE),
      ...(episode
        ? {
            seasonNumber: item.ParentIndexNumber ?? 1,
            episodeNumber: item.IndexNumber ?? 1,
          }
        : {}),
    },
    user: {
      watchedAt: playedAt,
      rating: 0, // unrated; user rates later
      review: "",
      tags: [],
    },
    source: {
      type: "jellyfin",
      jellyfin: {
        itemId: item.Id,
        playedAt,
        playCount: item.UserData?.PlayCount ?? 1,
      },
    },
    mediaCache: {},
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** Dedup identity: itemId + playedAt (schema Phase 0 reservation). */
export function jellyfinIdentity(record: MovieRecord): string | null {
  const jf = record.source.jellyfin;
  if (record.source.type !== "jellyfin" || !jf) return null;
  return `${jf.itemId}@${jf.playedAt}`;
}

/** Filter items to importable ones and map them (nulls dropped). */
export function mapItems(
  items: readonly JellyfinItem[],
  generateId: () => string,
  nowIso: string,
): readonly MovieRecord[] {
  return items
    .map((item) => mapItemToRecord(item, generateId, nowIso))
    .filter((r): r is MovieRecord => r !== null);
}

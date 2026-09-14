/**
 * TMDB snapshot builders: candidate/detail payloads -> the core's
 * TmdbSnapshot shape, with the Phase 1 sentinel contract fully
 * replaced by real values (spec: 绑定替换哨兵).
 */
import { type MovieRecord, type TmdbSnapshot } from "@auktake/core";
import type { RawEpisode, RawSearchItem, RawTvDetail } from "./tmdb-client";

export function buildMovieSnapshot(detail: RawSearchItem): TmdbSnapshot {
  return {
    id: detail.id,
    mediaType: "movie",
    title: detail.title ?? "",
    originalTitle: detail.original_title ?? detail.title ?? "",
    overview: detail.overview ?? "",
    posterPath: detail.poster_path ?? "",
    backdropPath: "",
    releaseDate: detail.release_date ?? "",
    genres: [],
    runtime: 0,
  };
}

export function buildMovieSnapshotFull(
  detail: RawSearchItem & {
    genres?: readonly { id: number; name: string }[];
    runtime?: number | null;
    backdrop_path?: string | null;
  },
): TmdbSnapshot {
  return {
    ...buildMovieSnapshot(detail),
    genres: detail.genres ?? [],
    runtime: detail.runtime ?? 0,
    backdropPath: detail.backdrop_path ?? "",
  };
}

export function buildEpisodeSnapshot(
  tv: RawTvDetail,
  episode: RawEpisode,
): TmdbSnapshot {
  const s = String(episode.season_number ?? 1).padStart(2, "0");
  const e = String(episode.episode_number ?? 1).padStart(2, "0");
  return {
    id: episode.id,
    mediaType: "episode",
    // series title carries the entry (Phase 1 manual semantics); the
    // SxxExx badge comes from seasonNumber/episodeNumber
    title: `${tv.name ?? ""} S${s}E${e}`,
    originalTitle: tv.original_name ?? tv.name ?? "",
    overview: episode.overview ?? tv.overview ?? "",
    posterPath: episode.still_path ?? tv.poster_path ?? "",
    backdropPath: tv.backdrop_path ?? "",
    releaseDate: episode.air_date ?? tv.first_air_date ?? "",
    genres: tv.genres ?? [],
    runtime: episode.runtime ?? tv.episode_run_time?.[0] ?? 0,
    seasonNumber: episode.season_number ?? 1,
    episodeNumber: episode.episode_number ?? 1,
  };
}

/** Sentinel test helper semantics: a snapshot is bound iff tmdb.id > 0. */
export function isBound(record: { tmdb: { id: number } }): boolean {
  return record.tmdb.id > 0;
}

export type { MovieRecord };

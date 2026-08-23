/**
 * Watch-record core entity.
 *
 * SEMANTICS (deliberate): one record per viewing. Watching the same
 * movie — or the same episode — again creates a NEW record (new ULID);
 * records are never merged or overwritten. AukTake is a viewing journal,
 * not a movie encyclopedia.
 */

/** TMDB genre entry. */
export interface TmdbGenre {
  readonly id: number;
  readonly name: string;
}

/** Inlined TMDB metadata snapshot (movie or episode). */
export interface TmdbSnapshot {
  readonly id: number;
  /** Discriminates movie vs episode records. */
  readonly mediaType: "movie" | "episode";
  readonly title: string;
  readonly originalTitle: string;
  readonly overview: string;
  /** TMDB original path, e.g. "/abc.jpg". */
  readonly posterPath: string;
  readonly backdropPath: string;
  /** "YYYY-MM-DD". */
  readonly releaseDate: string;
  readonly genres: readonly TmdbGenre[];
  /** Minutes. */
  readonly runtime: number;
  /** Present only when mediaType === "episode". */
  readonly seasonNumber?: number;
  /** Present only when mediaType === "episode". */
  readonly episodeNumber?: number;
}

/** User-authored data. */
export interface RecordUser {
  /** ISO 8601 date (day precision is enough). */
  readonly watchedAt: string;
  /** 0–10 in 0.5 steps. 0 means "unrated" (NOT a zero score). */
  readonly rating: number;
  /** Free-form review text, newlines allowed. */
  readonly review: string;
  /** Tag ids referencing the "tags" collection. */
  readonly tags: readonly string[];
}

/** Origin tracking. */
export interface RecordSource {
  readonly type: "manual" | "jellyfin" | "import";
  readonly jellyfin?: {
    readonly itemId: string;
    readonly playedAt: string;
    readonly playCount: number;
  };
}

/** Local media cache paths, written by the image-cache plugin. */
export interface RecordMediaCache {
  readonly poster?: string;
  readonly backdrop?: string;
  readonly stills?: readonly string[];
}

/** Share-poster output, written by the poster plugin. */
export interface RecordShare {
  readonly posterPath?: string;
  readonly templateId?: string;
}

/** The viewing record. id is a ULID. */
export interface MovieRecord {
  readonly id: string;
  readonly schemaVersion: number;
  readonly tmdb: TmdbSnapshot;
  readonly user: RecordUser;
  readonly source: RecordSource;
  readonly mediaCache: RecordMediaCache;
  readonly share?: RecordShare;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Current schema version; bump with a migration path, never silently. */
export const RECORD_SCHEMA_VERSION = 1;

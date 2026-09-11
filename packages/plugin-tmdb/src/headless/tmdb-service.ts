/**
 * Session-level TMDB service: candidate mapping, config resolution
 * (user override via syncMeta -> built-in default key), backfill
 * confidence rules. Pure headless — Storage and fetch injected.
 */
import { COLLECTIONS, type EventBus, type Storage } from "@auktake/core";
import {
  DEFAULT_TMDB_CONFIG,
  type TmdbBackfillResult,
  type TmdbCandidate,
  type TmdbConfig,
} from "@auktake/ui-contracts";
import { TmdbClient, TmdbError, type FetchLike, type RawSearchItem } from "./tmdb-client";
import { buildEpisodeSnapshot, buildMovieSnapshotFull } from "./snapshot";
import builtinKey from "../builtin-key.json";

const CONFIG_ID = "tmdb-config";

interface StoredConfig extends TmdbConfig {
  readonly id: string;
  readonly schemaVersion: number;
}

/** Normalize a title for high-confidence matching (case/space/punct). */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[[:：·・.。!！?？'"''""（）()\-—–,，、;；]/g, "");
}

export interface TmdbServiceDeps {
  readonly storage: Storage;
  readonly events: EventBus;
  readonly fetchImpl: FetchLike;
}

export class TmdbService {
  private config: TmdbConfig = DEFAULT_TMDB_CONFIG;

  constructor(private readonly deps: TmdbServiceDeps) {}

  /** Load persisted user config (falls back to defaults). */
  async loadConfig(): Promise<TmdbConfig> {
    const rows = await this.deps.storage.loadAll<StoredConfig>(COLLECTIONS.syncMeta);
    const stored = rows.find((r) => r.id === CONFIG_ID);
    this.config = {
      apiKey: stored?.apiKey ?? "",
      language: stored?.language ?? DEFAULT_TMDB_CONFIG.language,
    };
    return this.config;
  }

  async saveConfig(config: TmdbConfig): Promise<void> {
    const rows = await this.deps.storage.loadAll<StoredConfig>(COLLECTIONS.syncMeta);
    const next = rows.filter((r) => r.id !== CONFIG_ID);
    next.push({ id: CONFIG_ID, schemaVersion: 1, ...config });
    await this.deps.storage.persistAll(COLLECTIONS.syncMeta, next);
    this.config = config;
  }

  /** Effective key: user override -> built-in default -> "" (degraded). */
  get effectiveKey(): string {
    return this.config.apiKey || builtinKey.apiKey;
  }

  get language(): string {
    return this.config.language;
  }

  get configured(): boolean {
    return this.effectiveKey.length > 0;
  }

  private client(): TmdbClient {
    return new TmdbClient({
      fetchImpl: this.deps.fetchImpl,
      apiKey: this.effectiveKey,
      language: this.language,
    });
  }

  /** cmd:tmdb-search — title -> candidates (movie or tv series). */
  async search(
    query: string,
    options?: { mediaType?: "movie" | "episode" },
  ): Promise<TmdbCandidate[]> {
    if (!this.configured) return [];
    const client = this.client();
    const mediaType = options?.mediaType ?? "movie";
    try {
      const raw =
        mediaType === "episode"
          ? await client.searchTv(query)
          : await client.searchMovie(query);
      return raw.map((item) => mapCandidate(item, mediaType));
    } catch (error) {
      if (error instanceof TmdbError && error.kind === "invalid-key") return [];
      throw error;
    }
  }

  /** Backfill one record: unique high-confidence match binds, else review. */
  async backfill(
    recordId: string,
    record: { title: string; mediaType: "movie" | "episode"; releaseYear?: string },
  ): Promise<TmdbBackfillResult> {
    const candidates = await this.search(record.title, { mediaType: record.mediaType });
    if (candidates.length === 0) return { status: "no-match", recordId };

    const target = normalizeTitle(record.title);
    const confident = candidates.filter((c) => {
      const titleMatch = normalizeTitle(c.title) === target;
      const yearOk =
        !record.releaseYear ||
        !c.releaseDate ||
        c.releaseDate.slice(0, 4) === record.releaseYear;
      return titleMatch && yearOk;
    });

    if (confident.length === 1) {
      return { status: "bound", recordId, tmdbId: confident[0]!.tmdbId };
    }
    if (confident.length > 1) {
      return { status: "needs-review", recordId, candidates: confident };
    }
    return { status: "needs-review", recordId, candidates: candidates.slice(0, 8) };
  }

  /** Resolve a picked candidate into a full TmdbSnapshot (editor binding). */
  async snapshotForCandidate(
    candidate: TmdbCandidate,
    episode?: { season: number; episode: number },
  ): Promise<import("@auktake/core").TmdbSnapshot> {
    if (!this.configured) throw new TmdbError("invalid-key", "TMDB not configured");
    const client = this.client();
    if (candidate.mediaType === "movie") {
      const detail = await client.movieDetail(candidate.tmdbId);
      return buildMovieSnapshotFull(detail);
    }
    const tvId = candidate.tvId ?? candidate.tmdbId;
    const [tv, ep] = await Promise.all([
      client.tvDetail(tvId),
      client.tvEpisode(tvId, episode?.season ?? 1, episode?.episode ?? 1),
    ]);
    return buildEpisodeSnapshot(tv, ep);
  }
}

function mapCandidate(item: RawSearchItem, mediaType: "movie" | "episode"): TmdbCandidate {
  const isTv = mediaType === "episode";
  return {
    tmdbId: item.id,
    mediaType,
    title: (isTv ? item.name : item.title) ?? "",
    originalTitle: (isTv ? item.original_name : item.original_title) ?? "",
    releaseDate: (isTv ? item.first_air_date : item.release_date) ?? "",
    posterPath: item.poster_path ?? "",
    overview: item.overview ?? "",
    ...(isTv ? { tvId: item.id } : {}),
  };
}

/** Records with tmdb.id === 0 — the Phase 1 sentinel backfill set. */
export function listSentinelRecords(
  records: readonly { id: string; tmdb: { id: number } }[],
): string[] {
  return records.filter((r) => r.tmdb.id === 0).map((r) => r.id);
}

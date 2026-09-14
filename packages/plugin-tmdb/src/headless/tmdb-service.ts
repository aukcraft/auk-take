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
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secret-crypto";

const CONFIG_ID = "tmdb-config";

/**
 * Credential hygiene on save: strip ALL internal whitespace (pasted
 * tokens wrap lines) and auto-move credentials pasted into the wrong
 * slot — eyJ... (JWT v4 token) in the v3 field, and a bare 32-char hex
 * v3 key in the v4 field both land correctly.
 */
export function normalizeConfig(config: TmdbConfig): TmdbConfig {
  const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, "");
  let apiKey = clean(config.apiKey);
  let v4Token = clean(config.v4Token);
  if (apiKey.startsWith("eyJ")) {
    if (!v4Token) v4Token = apiKey;
    apiKey = "";
  } else if (v4Token && !v4Token.startsWith("eyJ") && /^[0-9a-f]{32}$/.test(v4Token)) {
    if (!apiKey) apiKey = v4Token;
    v4Token = "";
  }
  return { apiKey, v4Token, language: config.language };
}

interface StoredConfig {
  readonly id: string;
  readonly schemaVersion: number;
  /** Encrypted at rest (v1:<iv>:<cipher>); legacy plaintext tolerated. */
  readonly apiKey?: string;
  readonly v4Token?: string;
  readonly language?: string;
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

  /** Load persisted user config (decrypt secrets; legacy plaintext tolerated). */
  async loadConfig(): Promise<TmdbConfig> {
    const rows = await this.deps.storage.loadAll<StoredConfig>(COLLECTIONS.syncMeta);
    const stored = rows.find((r) => r.id === CONFIG_ID);
    const reveal = (value: string | undefined): string => {
      if (!value) return "";
      return isEncryptedSecret(value) ? decryptSecret(value) : value;
    };
    this.config = {
      apiKey: reveal(stored?.apiKey),
      v4Token: reveal(stored?.v4Token),
      language: stored?.language ?? DEFAULT_TMDB_CONFIG.language,
    };
    return this.config;
  }

  /**
   * Persist with SECRETS ENCRYPTED; plaintext never touches storage.
   * Footprint guard: a v4 token (eyJ...) pasted into the v3 key field
   * is auto-moved to v4Token instead of 401-ing forever.
   */
  async saveConfig(rawConfig: TmdbConfig): Promise<void> {
    const config = normalizeConfig(rawConfig);
    const rows = await this.deps.storage.loadAll<StoredConfig>(COLLECTIONS.syncMeta);
    const next = rows.filter((r) => r.id !== CONFIG_ID);
    next.push({
      id: CONFIG_ID,
      schemaVersion: 1,
      apiKey: encryptSecret(config.apiKey),
      v4Token: encryptSecret(config.v4Token ?? ""),
      language: config.language,
    });
    await this.deps.storage.persistAll(COLLECTIONS.syncMeta, next);
    this.config = config;
  }

  /**
   * Effective credential: user override -> built-in channel (v4 token
   * from TMDB_V4_READ_ACCESS_TOKEN injection, else v3 key).
   */
  get effectiveCredential(): { v4Token?: string; apiKey?: string } {
    if (this.config.v4Token || this.config.apiKey) {
      return {
        ...(this.config.v4Token ? { v4Token: this.config.v4Token } : {}),
        ...(this.config.apiKey ? { apiKey: this.config.apiKey } : {}),
      };
    }
    return {
      ...(builtinKey.v4Token ? { v4Token: builtinKey.v4Token } : {}),
      ...(builtinKey.apiKey ? { apiKey: builtinKey.apiKey } : {}),
    };
  }

  get language(): string {
    return this.config.language;
  }

  /** Plaintext USER config (not builtin) — for the settings dialog. */
  get configApiKey(): string {
    return this.config.apiKey;
  }

  get configV4Token(): string {
    return this.config.v4Token ?? "";
  }

  get configured(): boolean {
    const c = this.effectiveCredential;
    return Boolean(c.v4Token || c.apiKey);
  }

  private client(): TmdbClient {
    return new TmdbClient({
      fetchImpl: this.deps.fetchImpl,
      credential: this.effectiveCredential,
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
    // Errors (incl. 401 invalid-key) propagate: a swallowed invalid key
    // used to render as "no results", hiding credential problems.
    const raw =
      mediaType === "episode"
        ? await client.searchTv(query)
        : await client.searchMovie(query);
    return raw.map((item) => mapCandidate(item, mediaType));
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

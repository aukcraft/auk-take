/**
 * TMDB HTTP client port: fetch is INJECTED, URL assembly is pure and
 * assertable in Node with a stub (spec: "TMDB 客户端口（headless）").
 * No real network in tests, ever.
 */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface TmdbClientDeps {
  readonly fetchImpl: FetchLike;
  readonly apiKey: string;
  readonly language: string;
  /** Override for tests; defaults to the public v3 API. */
  readonly baseUrl?: string;
}

export type TmdbErrorKind = "invalid-key" | "network" | "upstream" | "not-found";

export class TmdbError extends Error {
  constructor(readonly kind: TmdbErrorKind, message: string) {
    super(message);
    this.name = "TmdbError";
  }
}

/** Raw TMDB search result item (subset we consume). */
export interface RawSearchItem {
  readonly id: number;
  readonly name?: string;
  readonly title?: string;
  readonly original_name?: string;
  readonly original_title?: string;
  readonly release_date?: string;
  readonly first_air_date?: string;
  readonly poster_path?: string | null;
  readonly overview?: string;
}

/** Raw episode detail (subset). */
export interface RawEpisode {
  readonly id: number;
  readonly name?: string;
  readonly overview?: string;
  readonly still_path?: string | null;
  readonly air_date?: string;
  readonly runtime?: number | null;
  readonly season_number?: number;
  readonly episode_number?: number;
}

interface RawPage {
  readonly results?: readonly RawSearchItem[];
}

/** Raw TV detail (subset, includes genres). */
export interface RawTvDetail {
  readonly id: number;
  readonly name?: string;
  readonly original_name?: string;
  readonly overview?: string;
  readonly poster_path?: string | null;
  readonly backdrop_path?: string | null;
  readonly first_air_date?: string;
  readonly genres?: readonly { id: number; name: string }[];
  readonly episode_run_time?: readonly number[];
}

export class TmdbClient {
  private readonly deps: TmdbClientDeps;

  constructor(deps: TmdbClientDeps) {
    this.deps = deps;
  }

  private get baseUrl(): string {
    return this.deps.baseUrl ?? "https://api.themoviedb.org/3";
  }

  /** Pure URL assembly — the seam tests assert against. */
  buildUrl(path: string, query: Record<string, string>): string {
    const params = new URLSearchParams({
      api_key: this.deps.apiKey,
      language: this.deps.language,
      ...query,
    });
    return `${this.baseUrl}${path}?${params.toString()}`;
  }

  private async request<T>(path: string, query: Record<string, string>): Promise<T> {
    let response: Response;
    try {
      response = await this.deps.fetchImpl(this.buildUrl(path, query));
    } catch (cause) {
      throw new TmdbError("network", `request failed: ${String(cause)}`);
    }
    if (response.status === 401) throw new TmdbError("invalid-key", "TMDB rejected the API key");
    if (response.status === 404) throw new TmdbError("not-found", "TMDB resource not found");
    if (!response.ok) throw new TmdbError("upstream", `TMDB HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  async searchMovie(query: string): Promise<readonly RawSearchItem[]> {
    const page = await this.request<RawPage>("/search/movie", { query });
    return page.results ?? [];
  }

  async searchTv(query: string): Promise<readonly RawSearchItem[]> {
    const page = await this.request<RawPage>("/search/tv", { query });
    return page.results ?? [];
  }

  async movieDetail(movieId: number): Promise<RawSearchItem> {
    return this.request<RawSearchItem>(`/movie/${movieId}`, {});
  }

  async tvDetail(tvId: number): Promise<RawTvDetail> {
    return this.request<RawTvDetail>(`/tv/${tvId}`, {});
  }

  /** Episode detail via season endpoint (episode_number filter). */
  async tvEpisode(tvId: number, season: number, episode: number): Promise<RawEpisode> {
    const seasonData = await this.request<{ episodes?: readonly RawEpisode[] }>(
      `/tv/${tvId}/season/${season}`,
      {},
    );
    const found = seasonData.episodes?.find((e) => e.episode_number === episode);
    if (!found) throw new TmdbError("not-found", `S${season}E${episode} not found`);
    return found;
  }
}

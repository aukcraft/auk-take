/**
 * Jellyfin REST client port (design D2): fetch via the injected http
 * (svc:http signature), auth header + URL assembly as pure functions.
 */
import type { HttpService } from "@auktake/ui-contracts";

export interface JellyfinClientDeps {
  readonly http: HttpService;
  readonly baseUrl: string;
  readonly apiKey: string;
}

/** Auth header value: MediaBrowser Token="<key>". */
export function authHeader(apiKey: string): { Authorization: string } {
  return { Authorization: `MediaBrowser Token="${apiKey}"` };
}

export interface JellyfinItem {
  readonly Id: string;
  readonly Name?: string;
  readonly Type?: string; // "Movie" | "Episode" | ...
  readonly SeriesName?: string;
  readonly ParentIndexNumber?: number;
  readonly IndexNumber?: number;
  readonly ProviderIds?: Readonly<Record<string, string>>;
  readonly Overview?: string;
  readonly Genres?: readonly string[];
  readonly RuntimeTicks?: number;
  readonly PremiereDate?: string;
  readonly UserData?: {
    readonly LastPlayedDate?: string;
    readonly PlayCount?: number;
    readonly Played?: boolean;
  };
}

export interface JellyfinUser {
  readonly Id: string;
  readonly Name?: string;
}

export interface JellyfinSystemInfo {
  readonly ServerName?: string;
  readonly Version?: string;
}

const PAGE_SIZE = 500;

/** One page of a played-items walk, plus the server-side total. */
export interface PlayedItemsPage {
  readonly items: readonly JellyfinItem[];
  /** TotalRecordCount from the server; null when omitted. */
  readonly total: number | null;
}

export class JellyfinClient {
  private readonly deps: JellyfinClientDeps;

  constructor(deps: JellyfinClientDeps) {
    this.deps = deps;
  }

  private normalizeBase(): string {
    return this.deps.baseUrl.replace(/\/+$/, "");
  }

  /** Pure URL assembly — the seam tests assert against. */
  buildUrl(path: string, query: Record<string, string | number> = {}): string {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])),
    );
    const qs = params.toString();
    return `${this.normalizeBase()}${path}${qs ? `?${qs}` : ""}`;
  }

  private async request<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
    const response = await this.deps.http(this.buildUrl(path, query), {
      headers: authHeader(this.deps.apiKey),
    });
    return (await response.json()) as T;
  }

  async systemInfo(): Promise<JellyfinSystemInfo> {
    return this.request<JellyfinSystemInfo>("/System/Info");
  }

  /** API-key-visible users; v1 uses the first (design open question). */
  async users(): Promise<readonly JellyfinUser[]> {
    return this.request<readonly JellyfinUser[]>("/Users");
  }

  async currentUser(): Promise<JellyfinUser | undefined> {
    const users = await this.users();
    return users[0];
  }

  private static readonly PLAYED_QUERY: Record<string, string | number> = {
    Filters: "IsPlayed",
    Recursive: "true",
    IncludeItemTypes: "Movie,Episode",
    Fields: "ProviderIds,Overview,Genres,RuntimeTicks,PremiereDate,SeriesName,ParentIndexNumber,IndexNumber",
    SortBy: "DatePlayed",
    // Oldest-first: batched sync walks from the distant past towards now,
    // so the resume cursor (a skip offset) stays valid as new plays append
    // at the END of the listing.
    SortOrder: "Ascending",
  };

  /**
   * One page of played Movie/Episode items.
   *
   * Jellyfin paginates with StartIndex/Limit (NOT Skip/Take — those are
   * silently IGNORED, which turned our first walk into an endless loop
   * of full-page responses; see design D2 revision). The response also
   * carries TotalRecordCount, which we use as a second termination
   * signal so a server that mishandles paging still stops the walk.
   */
  async playedItemsPage(
    userId: string,
    startIndex: number,
    limit: number = PAGE_SIZE,
  ): Promise<PlayedItemsPage> {
    const page = await this.request<{
      Items?: readonly JellyfinItem[];
      TotalRecordCount?: number;
    }>(`/Users/${userId}/Items`, {
      ...JellyfinClient.PLAYED_QUERY,
      StartIndex: startIndex,
      Limit: limit,
    });
    const items = page.Items ?? [];
    return { items, total: page.TotalRecordCount ?? null };
  }

  /** All played Movie/Episode items, paged to completion. */
  async playedItems(userId: string): Promise<readonly JellyfinItem[]> {
    const out: JellyfinItem[] = [];
    let startIndex = 0;
    for (;;) {
      const { items, total } = await this.playedItemsPage(userId, startIndex);
      out.push(...items);
      startIndex += items.length;
      if (items.length < PAGE_SIZE) break;
      if (total !== null && startIndex >= total) break;
    }
    return out;
  }
}

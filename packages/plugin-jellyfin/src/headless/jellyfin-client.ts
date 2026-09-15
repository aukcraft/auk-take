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

  /** All played Movie/Episode items, paged to completion. */
  async playedItems(userId: string): Promise<readonly JellyfinItem[]> {
    const base: Record<string, string | number> = {
      Filters: "IsPlayed",
      Recursive: "true",
      IncludeItemTypes: "Movie,Episode",
      Fields: "ProviderIds,Overview,Genres,RuntimeTicks,PremiereDate,SeriesName,ParentIndexNumber,IndexNumber",
      SortBy: "DatePlayed",
      SortOrder: "Descending",
    };
    const out: JellyfinItem[] = [];
    let skip = 0;
    for (;;) {
      const page = await this.request<{ Items?: readonly JellyfinItem[] }>(
        `/Users/${userId}/Items`,
        { ...base, Skip: skip, Take: PAGE_SIZE },
      );
      const items = page.Items ?? [];
      out.push(...items);
      if (items.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
    }
    return out;
  }
}

/**
 * Poster image cache: deterministic URL-derived keys (same URL -> same
 * file on both platforms), atomic writes (tmp + rename), LRU capacity
 * eviction with a persisted index, silent null on any failure (spec:
 * image-cache capability). Pure headless; fs + fetch injected.
 */
import type { ImageCacheService } from "@auktake/ui-contracts";
import type { BinaryFsPort } from "./fs-port";
import type { FetchLike } from "./tmdb-client";

/** UTF-8 helpers without DOM lib (ES2022-only tsconfig). */
function encodeUtf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
  }
  return Uint8Array.from(out);
}
function decodeUtf8(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b < 0x80) {
      out += String.fromCodePoint(b);
      i += 1;
    } else if (b < 0xe0) {
      out += String.fromCodePoint(((b & 0x1f) << 6) | (bytes[i + 1]! & 63));
      i += 2;
    } else if (b < 0xf0) {
      out += String.fromCodePoint(((b & 0x0f) << 12) | ((bytes[i + 1]! & 63) << 6) | (bytes[i + 2]! & 63));
      i += 3;
    } else {
      out += String.fromCodePoint(
        ((b & 0x07) << 18) |
          ((bytes[i + 1]! & 63) << 12) |
          ((bytes[i + 2]! & 63) << 6) |
          (bytes[i + 3]! & 63),
      );
      i += 4;
    }
  }
  return out;
}

/** Cheap synchronous cache key: FNV-1a x2 (deterministic on both ends). */
export function cacheKeyFor(url: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < url.length; i++) {
    h1 ^= url.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ url.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export interface CacheIndexEntry {
  readonly key: string;
  readonly size: number;
  /** Monotonic use counter; larger = more recent. */
  usedAt: number;
  /** Phase 5: capacity tier derived from the URL size segment. */
  readonly tier?: ImageTier;
}

/**
 * Phase 5 tiering: poster / backdrop / still lanes (spec image-cache
 * "LRU 容量与原子写"). Classification uses the TMDB size segment
 * (/t/p/<size>/); unknown/non-TMDB URLs land in the poster lane.
 */
export type ImageTier = "poster" | "backdrop" | "still";

export function tierForUrl(url: string): ImageTier {
  const size = /\/t\/p\/(w\d+|original)\//.exec(url)?.[1] ?? "";
  if (size === "w780" || size === "w1280" || size === "original") return "backdrop";
  if (size === "w300") return "still";
  return "poster";
}

/** Lane capacity shares: posters dominate; backdrops/stills get the rest. */
export const TIER_SHARES: Readonly<Record<ImageTier, number>> = {
  poster: 0.7,
  backdrop: 0.2,
  still: 0.1,
};

/**
 * Tiered LRU eviction plan: an incoming write evicts the oldest entries
 * WITHIN ITS OWN lane until that lane fits its share. Lanes never
 * evict each other's entries — poster capacity is never eaten by
 * backdrops (spec scenario "backdrop 入缓存").
 */
export function tieredEvictPlan(
  entries: readonly CacheIndexEntry[],
  incomingTier: ImageTier,
  incomingBytes: number,
  capacityBytes: number,
): string[] {
  const lane = entries.filter((e) => (e.tier ?? "poster") === incomingTier);
  const laneCapacity = Math.floor(capacityBytes * TIER_SHARES[incomingTier]);
  const total = lane.reduce((sum, e) => sum + e.size, 0) + incomingBytes;
  if (total <= laneCapacity) return [];
  const byAge = [...lane].sort((a, b) => a.usedAt - b.usedAt);
  const victims: string[] = [];
  let freed = 0;
  const excess = total - laneCapacity;
  for (const entry of byAge) {
    if (freed >= excess) break;
    victims.push(entry.key);
    freed += entry.size;
  }
  return victims;
}

/** Pure LRU eviction plan (testable): returns keys to delete. */
export function evictPlan(
  entries: readonly CacheIndexEntry[],
  capacityBytes: number,
  incomingBytes: number,
): string[] {
  const total = entries.reduce((sum, e) => sum + e.size, 0) + incomingBytes;
  if (total <= capacityBytes) return [];
  const byAge = [...entries].sort((a, b) => a.usedAt - b.usedAt); // oldest first
  const victims: string[] = [];
  let freed = 0;
  const excess = total - capacityBytes;
  for (const entry of byAge) {
    if (freed >= excess) break;
    victims.push(entry.key);
    freed += entry.size;
  }
  return victims;
}

export interface ImageCacheDeps {
  readonly fs: BinaryFsPort;
  readonly fetchImpl: FetchLike;
  readonly cacheDir: string;
  readonly capacityBytes?: number;
}

const DEFAULT_CAPACITY = 200 * 1024 * 1024; // 200MB poster library
const INDEX_NAME = "index.json";

export class ImageCache implements ImageCacheService {
  private readonly deps: ImageCacheDeps;
  private readonly capacity: number;
  private index = new Map<string, CacheIndexEntry>();
  private counter = 0;
  private ready = false;

  constructor(deps: ImageCacheDeps) {
    this.deps = deps;
    this.capacity = deps.capacityBytes ?? DEFAULT_CAPACITY;
  }

  private indexPath(): string {
    return `${this.deps.cacheDir}/${INDEX_NAME}`;
  }

  private fileName(key: string): string {
    return `${this.deps.cacheDir}/${key}.img`;
  }

  private async ensureReady(): Promise<boolean> {
    if (this.ready) return true;
    try {
      await this.deps.fs.mkdir(this.deps.cacheDir);
      await this.loadIndex();
      this.ready = true;
      return true;
    } catch {
      return false;
    }
  }

  private async loadIndex(): Promise<void> {
    const raw = await this.deps.fs.readFile(this.indexPath());
    if (raw === null) {
      await this.rebuildIndexFromDir();
      return;
    }
    try {
      const parsed = JSON.parse(decodeUtf8(raw)) as CacheIndexEntry[];
      this.index = new Map(parsed.map((e) => [e.key, e]));
    } catch {
      // corrupt index: rebuild from directory, drop orphans
      await this.rebuildIndexFromDir();
    }
  }

  /** Index rebuild: directory scan; files without size info get 0-size stats. */
  private async rebuildIndexFromDir(): Promise<void> {
    this.index = new Map();
    const list = this.deps.fs.list ? await this.deps.fs.list(this.deps.cacheDir) : [];
    for (const name of list) {
      if (!name.endsWith(".img")) continue;
      const key = name.slice(0, -4);
      const stat = await this.deps.fs.readFile(`${this.deps.cacheDir}/${name}`);
      this.index.set(key, { key, size: stat?.length ?? 0, usedAt: ++this.counter });
    }
    await this.persistIndex();
  }

  private async persistIndex(): Promise<void> {
    const json = encodeUtf8(JSON.stringify([...this.index.values()]));
    await this.deps.fs.writeFile(this.indexPath(), json);
  }

  async resolve(url: string): Promise<string | null> {
    if (!(await this.ensureReady())) return null;
    const key = cacheKeyFor(url);
    const path = this.fileName(key);

    const hit = this.index.get(key);
    if (hit && (await this.deps.fs.readFile(path)) !== null) {
      hit.usedAt = ++this.counter;
      void this.persistIndex();
      return path;
    }

    try {
      const response = await this.deps.fetchImpl(url);
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0) return null;

      const tier = tierForUrl(url);
      for (const victim of tieredEvictPlan([...this.index.values()], tier, bytes.length, this.capacity)) {
        await this.deps.fs.remove(this.fileName(victim));
        this.index.delete(victim);
      }

      const tmp = `${path}.tmp`;
      await this.deps.fs.writeFile(tmp, bytes);
      await this.deps.fs.rename(tmp, path); // atomic swap-in
      this.index.set(key, { key, size: bytes.length, usedAt: ++this.counter, tier });
      await this.persistIndex();
      return path;
    } catch {
      return null; // silent degradation (spec: 失败降级)
    }
  }

  async clear(): Promise<void> {
    if (!(await this.ensureReady())) return;
    for (const key of [...this.index.keys()]) {
      await this.deps.fs.remove(this.fileName(key));
    }
    this.index = new Map();
    await this.persistIndex();
  }
}

/**
 * cmd:share-poster flow (headless, D3): record -> poster dataURL
 * (best-effort via image cache + fs, color-card fallback) -> SVG ->
 * platform export port. Every stage degrades — sharing NEVER fails
 * over a missing image.
 */
import { COLLECTIONS, type MovieRecord, type Storage } from "@auktake/core";
import {
  IMAGE_CACHE_SERVICE,
  tmdbImageUrl,
  type ImageCacheService,
  type SharePosterCommand,
  type ShareResult,
} from "@auktake/ui-contracts";
import { renderShareCard } from "./share-card";
import { shareSummary, type ShareExportPort } from "./export-port";

/** Structural subset of the fs service (defined in plugin-tmdb). */
export interface BinaryReader {
  readFile(path: string): Promise<Uint8Array | null>;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Platform-safe base64 (RN has no btoa). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2]! + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    out += c === undefined ? "=" : B64[c & 63]!;
  }
  return out;
}

export interface ShareCommandDeps {
  readonly storage: Storage;
  readonly imageCache?: ImageCacheService;
  readonly fs?: BinaryReader;
  readonly exportPort: ShareExportPort;
}

export function createSharePosterCommand(deps: ShareCommandDeps): SharePosterCommand {
  return async (recordId: string): Promise<ShareResult> => {
    const records = await deps.storage.loadAll<MovieRecord>(COLLECTIONS.records);
    const record = records.find((r) => r.id === recordId);
    if (!record) return { status: "error", message: `记录不存在：${recordId}` };

    // Best-effort poster -> dataURL; any failure falls back to the
    // palette placeholder inside renderShareCard.
    let posterDataUrl: string | undefined;
    try {
      const url = tmdbImageUrl(record.tmdb.posterPath);
      if (url && deps.imageCache && deps.fs) {
        const localPath = await deps.imageCache.resolve(url);
        if (localPath) {
          const bytes = await deps.fs.readFile(localPath);
          if (bytes) {
            const mime = localPath.endsWith(".png") ? "image/png" : "image/jpeg";
            posterDataUrl = `data:${mime};base64,${bytesToBase64(bytes)}`;
          }
        }
      }
    } catch {
      posterDataUrl = undefined;
    }

    const svg = renderShareCard(record, posterDataUrl);
    return deps.exportPort.export({
      svg,
      summary: shareSummary(record),
      fileName: `auktake-${record.tmdb.title.replace(/[\\/:*?"<>|]/g, "_")}.png`,
    });
  };
}

export { IMAGE_CACHE_SERVICE };

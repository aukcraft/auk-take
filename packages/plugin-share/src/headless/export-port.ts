/**
 * Share export ports (headless contracts + platform factories, D3):
 * - desktop: SVG -> canvas rasterize -> PNG download (no new deps)
 * - mobile: text summary via RN's built-in Share (no fs port exists on
 *   mobile yet — file-based SVG sharing is deferred to Phase 7)
 *
 * `ShareExportPort` is injectable so the command flow is testable in
 * plain Node with a stub port.
 */
import type { MovieRecord } from "@auktake/core";
import type { ShareResult } from "@auktake/ui-contracts";

export interface ShareExportInput {
  /** SVG markup of the rendered card (desktop rasterizes it). */
  readonly svg: string;
  /** Plain-text summary (mobile share body / fallback). */
  readonly summary: string;
  /** Suggested file name without directory (desktop download). */
  readonly fileName: string;
}

export interface ShareExportPort {
  export(input: ShareExportInput): Promise<ShareResult>;
}

/** Pure text summary for share targets that cannot take an image. */
export function shareSummary(record: MovieRecord): string {
  const badge =
    record.tmdb.mediaType === "episode"
      ? ` S${String(record.tmdb.seasonNumber ?? 1).padStart(2, "0")}E${String(record.tmdb.episodeNumber ?? 1).padStart(2, "0")}`
      : "";
  const rating = record.user.rating > 0 ? `★${record.user.rating.toFixed(1)}` : "未评分";
  const review = record.user.review.trim().replace(/\s+/g, " ");
  const excerpt = review.length > 80 ? `${review.slice(0, 80)}…` : review;
  return `《${record.tmdb.title}${badge}》 ${rating} · ${record.user.watchedAt}${excerpt ? `\n${excerpt}` : ""}\n— AukTake 观影记录`;
}

/** Minimal structural DOM shapes (packages build without the DOM lib). */
interface ImageLike {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}
interface CanvasContextLike {
  drawImage(img: ImageLike, x: number, y: number): void;
}
interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: "2d"): CanvasContextLike | null;
  toDataURL(type: string): string;
}
interface AnchorLike {
  href: string;
  download: string;
  click(): void;
}
interface DocumentLike {
  createElement(tag: "img"): ImageLike;
  createElement(tag: "canvas"): CanvasLike;
  createElement(tag: "a"): AnchorLike;
}
interface UrlLike {
  createObjectURL(blob: unknown): string;
  revokeObjectURL(url: string): void;
}
interface BlobCtor {
  new (parts: readonly unknown[], options: { type: string }): unknown;
}

/**
 * Desktop (web/Tauri): rasterize the SVG via <img> + canvas and trigger
 * a PNG download. Injectable factories keep this unit-testable without
 * jsdom — real shells pass nothing.
 */
export function createWebShareExport(deps?: {
  createImage?: () => ImageLike;
  createCanvas?: () => CanvasLike;
  download?: (blobUrl: string, fileName: string) => void;
}): ShareExportPort {
  return {
    async export({ svg, fileName }) {
      const g = globalThis as unknown as {
        document?: DocumentLike;
        URL?: UrlLike;
        Blob?: BlobCtor;
      };
      if (!g.document || !g.URL || !g.Blob) {
        return { status: "error", message: "当前环境不支持 PNG 导出" };
      }
      try {
        const svgUrl = g.URL.createObjectURL(new g.Blob([svg], { type: "image/svg+xml" }));
        const img = deps?.createImage ? deps.createImage() : g.document.createElement("img");
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("SVG 栅格化失败"));
          img.src = svgUrl;
        });
        const canvas = deps?.createCanvas ? deps.createCanvas() : g.document.createElement("canvas");
        canvas.width = img.naturalWidth || 1080;
        canvas.height = img.naturalHeight || 1350;
        const ctx = canvas.getContext("2d");
        if (!ctx) return { status: "error", message: "canvas 2d 上下文不可用" };
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL("image/png");
        g.URL.revokeObjectURL(svgUrl);
        if (deps?.download) {
          deps.download(pngUrl, fileName);
        } else {
          const a = g.document.createElement("a");
          a.href = pngUrl;
          a.download = fileName;
          a.click();
        }
        return { status: "downloaded" };
      } catch (error) {
        return { status: "error", message: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

/** Minimal shape of RN's Share module (injected for testability). */
export interface NativeShareModule {
  share(content: { message: string }): Promise<{ action: string }>;
  sharedAction: string;
  dismissedAction: string;
}

/**
 * Mobile: RN built-in Share with the text summary (no fs port on mobile
 * yet — design D3 defers SVG file sharing to Phase 7).
 */
export function createNativeShareExport(share: NativeShareModule): ShareExportPort {
  return {
    async export({ summary }) {
      try {
        const result = await share.share({ message: summary });
        return result.action === share.sharedAction
          ? { status: "shared" }
          : { status: "cancelled" };
      } catch {
        return { status: "cancelled" };
      }
    },
  };
}

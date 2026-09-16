/**
 * Share export ports (headless contracts + platform factories, D3):
 * - desktop: canvas composes the card DIRECTLY from the structured
 *   model (routing the SVG through <img> taints the canvas in WebKit)
 *   and the PNG bytes are written via the fs port — a Tauri webview
 *   has no browser download manager, anchor downloads are silent no-ops
 * - mobile: text summary via RN's built-in Share (no fs port exists on
 *   mobile yet — file-based sharing is deferred to Phase 7)
 *
 * `ShareExportPort` is injectable so the command flow is testable in
 * plain Node with a stub port.
 */
import type { MovieRecord } from "@auktake/core";
import type { ShareResult } from "@auktake/ui-contracts";
import { SHARE_CARD, type ShareCardModel } from "./share-card";

export interface ShareExportInput {
  /** SVG markup of the rendered card (kept for fidelity/tests). */
  readonly svg: string;
  /** Structured card content (desktop canvas draws from this). */
  readonly model: ShareCardModel;
  /** Plain-text summary (mobile share body / fallback). */
  readonly summary: string;
  /** Suggested file name without directory (desktop export). */
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
  fillStyle: string;
  font: string;
  textAlign: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  drawImage(img: ImageLike, dx: number, dy: number, dw: number, dh: number): void;
}
interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: "2d"): CanvasContextLike | null;
  toDataURL(type: string): string;
}
interface DocumentLike {
  createElement(tag: "img"): ImageLike;
  createElement(tag: "canvas"): CanvasLike;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Platform-safe base64 decode (RN Hermes has no reliable atob). */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64_CHARS.indexOf(clean[i]!) << 18) |
      (B64_CHARS.indexOf(clean[i + 1] ?? "A") << 12) |
      (B64_CHARS.indexOf(clean[i + 2] ?? "A") << 6) |
      B64_CHARS.indexOf(clean[i + 3] ?? "A");
    if (o < out.length) out[o++] = (n >> 16) & 0xff;
    if (o < out.length) out[o++] = (n >> 8) & 0xff;
    if (o < out.length) out[o++] = n & 0xff;
  }
  return out;
}

/** data: base64 URL -> bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  return base64ToBytes(dataUrl.slice(dataUrl.indexOf(",") + 1));
}

/** Structural subset of the fs service used for PNG output. */
export interface BinaryWriter {
  mkdir(path: string): Promise<void>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

export interface DesktopShareExportDeps {
  readonly fs: BinaryWriter;
  /** Output directory (relative paths resolve under the shell's data dir). */
  readonly dir: string;
  /** Test seams — real shells pass nothing. */
  readonly createImage?: () => ImageLike;
  readonly createCanvas?: () => CanvasLike;
}

/**
 * Desktop (web/Tauri): draw the card on a canvas from the model and
 * write the PNG via the fs port, returning the written path.
 */
export function createDesktopShareExport(deps: DesktopShareExportDeps): ShareExportPort {
  return {
    async export({ model, fileName }) {
      const g = globalThis as unknown as { document?: DocumentLike };
      const canvas = deps.createCanvas
        ? deps.createCanvas()
        : g.document?.createElement("canvas");
      if (!canvas) return { status: "error", message: "当前环境不支持 PNG 导出" };
      try {
        const { width: W, height: H } = SHARE_CARD;
        const posterH = 810;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return { status: "error", message: "canvas 2d 上下文不可用" };

        ctx.fillStyle = "#101014";
        ctx.fillRect(0, 0, W, H);

        if (model.posterDataUrl) {
          const img = deps.createImage
            ? deps.createImage()
            : g.document!.createElement("img");
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("海报解码失败"));
            img.src = model.posterDataUrl!;
          });
          // cover-slice into the poster band
          const iw = img.naturalWidth || W;
          const ih = img.naturalHeight || posterH;
          const scale = Math.max(W / iw, posterH / ih);
          const dw = iw * scale;
          const dh = ih * scale;
          ctx.drawImage(img, (W - dw) / 2, (posterH - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = model.palette.bg;
          ctx.fillRect(0, 0, W, posterH);
          ctx.fillStyle = model.palette.fg;
          ctx.font = "600 72px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(model.title.slice(0, 12), W / 2, posterH / 2);
        }

        ctx.textAlign = "left";
        ctx.fillStyle = "#EDEDF2";
        ctx.font = "700 52px sans-serif";
        ctx.fillText(model.title + (model.badge ? ` ${model.badge}` : ""), 72, posterH + 90, W - 144);
        ctx.fillStyle = "#7C6CF0";
        ctx.font = "34px sans-serif";
        ctx.fillText(`${model.ratingText} · ${model.watchedAt}`, 72, posterH + 160);
        if (model.excerpt) {
          ctx.fillStyle = "#9A9AA6";
          ctx.font = "30px sans-serif";
          ctx.fillText(model.excerpt, 72, posterH + 250, W - 144);
        }
        ctx.fillStyle = "#9A9AA6";
        ctx.font = "26px sans-serif";
        ctx.fillText(model.footer, 72, H - 56);

        const bytes = dataUrlToBytes(canvas.toDataURL("image/png"));
        const path = `${deps.dir}/${fileName}`;
        await deps.fs.mkdir(deps.dir);
        await deps.fs.writeFile(path, bytes);
        return { status: "downloaded", path };
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

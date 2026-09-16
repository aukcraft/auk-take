/**
 * plugin-share factory (design D3): recommended tier. Registers
 * cmd:share-poster; the export port is resolved lazily per platform —
 * desktop draws the card on a canvas and writes the PNG via the fs
 * port (a Tauri webview has no download manager; SVG-through-<img>
 * taints canvas in WebKit), mobile uses RN's built-in Share with the
 * text summary (no fs port on mobile yet).
 */
import type { AukPlugin, Storage } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  FS_SERVICE,
  IMAGE_CACHE_SERVICE,
  STORAGE_SERVICE,
  type ImageCacheService,
  type PluginRuntimeDeps,
  type SharePosterCommand,
} from "@auktake/ui-contracts";
import {
  createDesktopShareExport,
  createNativeShareExport,
  type BinaryWriter,
  type NativeShareModule,
  type ShareExportPort,
} from "./headless/export-port";
import { createSharePosterCommand, type BinaryReader } from "./headless/share-command";

async function resolveExportPort(
  dev: boolean,
  fs: BinaryWriter | undefined,
  exportDir: string,
): Promise<ShareExportPort | undefined> {
  if ((globalThis as { document?: unknown }).document !== undefined) {
    return fs
      ? createDesktopShareExport({ fs, dir: exportDir })
      : undefined; // desktop export requires the fs port (Tauri shells register it)
  }
  try {
    const mod = (await import("react-native")) as unknown as { Share?: NativeShareModule };
    if (mod.Share) return createNativeShareExport(mod.Share);
  } catch (error) {
    if (dev) console.warn("[share] react-native Share unavailable", error);
  }
  return undefined;
}

export interface SharePluginOptions {
  /** Desktop PNG output directory (relative -> shell data dir). */
  readonly exportDir?: string;
}

export function createSharePlugin(deps: PluginRuntimeDeps, options?: SharePluginOptions): AukPlugin {
  const exportDir = options?.exportDir ?? "share-exports";
  return {
    id: "share",
    tier: "recommended",
    permissions: ["storage:read"],

    async connect() {
      return { state: {} };
    },

    create() {
      const storage = deps.services.require<Storage>(STORAGE_SERVICE);
      const imageCache = deps.services.get<ImageCacheService>(IMAGE_CACHE_SERVICE);
      const fs = deps.services.get<BinaryReader & BinaryWriter>(FS_SERVICE);

      const share: SharePosterCommand = async (recordId) => {
        const port = await resolveExportPort(deps.dev === true, fs, exportDir);
        if (!port) return { status: "error", message: "当前平台不支持分享导出" };
        return createSharePosterCommand({ storage, imageCache, fs, exportPort: port })(recordId);
      };
      deps.capabilities.register(CAPABILITY_KEYS.sharePoster, share);

      return {
        dispose() {
          deps.capabilities.unregister(CAPABILITY_KEYS.sharePoster);
        },
      };
    },
  };
}

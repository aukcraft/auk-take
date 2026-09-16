/**
 * plugin-share factory (design D3): recommended tier. Registers
 * cmd:share-poster; the export port is resolved lazily per platform —
 * web/canvas on desktop, RN's built-in Share (text summary) on mobile.
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
  createNativeShareExport,
  createWebShareExport,
  type NativeShareModule,
  type ShareExportPort,
} from "./headless/export-port";
import { createSharePosterCommand, type BinaryReader } from "./headless/share-command";

async function resolveExportPort(dev: boolean): Promise<ShareExportPort | undefined> {
  if ((globalThis as { document?: unknown }).document !== undefined) return createWebShareExport();
  try {
    const mod = (await import("react-native")) as unknown as { Share?: NativeShareModule };
    if (mod.Share) return createNativeShareExport(mod.Share);
  } catch (error) {
    if (dev) console.warn("[share] react-native Share unavailable", error);
  }
  return undefined;
}

export function createSharePlugin(deps: PluginRuntimeDeps): AukPlugin {
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
      const fs = deps.services.get<BinaryReader>(FS_SERVICE);

      const share: SharePosterCommand = async (recordId) => {
        const port = await resolveExportPort(deps.dev === true);
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

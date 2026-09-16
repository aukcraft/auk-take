import { describe, expect, it } from "vitest";
import { COLLECTIONS, InMemoryStorage, type MovieRecord } from "@auktake/core";
import type { ShareResult } from "@auktake/ui-contracts";
import { renderShareCard, SHARE_CARD } from "../src/headless/share-card";
import { shareSummary, createNativeShareExport } from "../src/headless/export-port";
import { bytesToBase64, createSharePosterCommand } from "../src/headless/share-command";

function makeRecord(overrides?: {
  id?: string;
  title?: string;
  rating?: number;
  review?: string;
  posterPath?: string;
  episode?: boolean;
}): MovieRecord {
  const title = overrides?.title ?? "沙丘2";
  return {
    id: overrides?.id ?? "rec-1",
    schemaVersion: 1,
    tmdb: {
      id: 693134,
      mediaType: overrides?.episode ? "episode" : "movie",
      title,
      originalTitle: title,
      overview: "",
      posterPath: overrides?.posterPath ?? "",
      backdropPath: "",
      releaseDate: "2024-03-01",
      genres: [],
      runtime: 166,
      ...(overrides?.episode ? { seasonNumber: 2, episodeNumber: 5 } : {}),
    },
    user: {
      watchedAt: "2026-05-01",
      rating: overrides?.rating ?? 8.5,
      review: overrides?.review ?? "",
      tags: [],
    },
    source: { type: "manual" },
    mediaCache: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("renderShareCard", () => {
  it("embeds the poster image when a dataURL is given", () => {
    const svg = renderShareCard(makeRecord({ posterPath: "/p.jpg" }), "data:image/jpeg;base64,AA==");
    expect(svg).toContain("<svg");
    expect(svg).toContain(`width="${SHARE_CARD.width}"`);
    expect(svg).toContain('href="data:image/jpeg;base64,AA=="');
    expect(svg).toContain("沙丘2");
    expect(svg).toContain("★ 8.5");
    expect(svg).toContain("2026-05-01");
  });

  it("falls back to the deterministic palette placeholder without an image", () => {
    const svg = renderShareCard(makeRecord());
    expect(svg).not.toContain("<image");
    expect(svg).toContain("<rect"); // palette block
    expect(svg).toContain("沙丘2"); // placeholder title text
  });

  it("renders episode badge and review excerpt, escapes XML", () => {
    const long = "好".repeat(200);
    const svg = renderShareCard(makeRecord({ episode: true, title: "A&B<剧>", review: long }));
    expect(svg).toContain("S02E05");
    expect(svg).toContain("A&amp;B&lt;剧&gt;");
    expect(svg).toContain("…");
    expect(svg).not.toContain("好".repeat(200));
  });

  it("explicit unrated text", () => {
    expect(renderShareCard(makeRecord({ rating: 0 }))).toContain("未评分");
  });
});

describe("shareSummary", () => {
  it("builds title/rating/date/excerpt text", () => {
    const text = shareSummary(makeRecord({ episode: true, review: "非常好看" }));
    expect(text).toContain("《沙丘2 S02E05》 ★8.5 · 2026-05-01");
    expect(text).toContain("非常好看");
  });
});

describe("bytesToBase64", () => {
  it("round-trips against Buffer", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253]);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
  });
});

describe("createSharePosterCommand", () => {
  async function setup(record?: MovieRecord) {
    const storage = new InMemoryStorage();
    if (record) await storage.persistAll(COLLECTIONS.records, [record]);
    const exported: { svg: string; summary: string }[] = [];
    const command = createSharePosterCommand({
      storage,
      exportPort: {
        async export(input) {
          exported.push(input);
          return { status: "downloaded" };
        },
      },
    });
    return { command, exported };
  }

  it("renders and exports for an existing record (no cache -> palette card)", async () => {
    const { command, exported } = await setup(makeRecord());
    const result = await command("rec-1");
    expect(result).toEqual({ status: "downloaded" });
    expect(exported[0]!.svg).toContain("沙丘2");
    expect(exported[0]!.svg).not.toContain("<image");
  });

  it("error result for an unknown record id", async () => {
    const { command } = await setup();
    const result = await command("nope");
    expect(result.status).toBe("error");
  });

  it("image failure never blocks sharing (cache throws -> still exports)", async () => {
    const storage = new InMemoryStorage();
    await storage.persistAll(COLLECTIONS.records, [makeRecord({ posterPath: "/p.jpg" })]);
    let exported = 0;
    const command = createSharePosterCommand({
      storage,
      imageCache: { async resolve() { throw new Error("cache down"); }, async clear() {} },
      exportPort: { async export() { exported += 1; return { status: "shared" }; } },
    });
    const result = await command("rec-1");
    expect(result).toEqual({ status: "shared" });
    expect(exported).toBe(1);
  });
});

describe("createNativeShareExport", () => {
  const module = (action: string) => ({
    sharedAction: "sharedAction",
    dismissedAction: "dismissedAction",
    async share() {
      return { action };
    },
  });

  it("maps shared/dismissed/rejected to shared/cancelled/cancelled", async () => {
    const port = createNativeShareExport(module("sharedAction"));
    expect(await port.export({ svg: "", summary: "s", fileName: "f" })).toEqual({ status: "shared" });
    const dismissed = createNativeShareExport(module("dismissedAction"));
    expect(await dismissed.export({ svg: "", summary: "s", fileName: "f" })).toEqual({ status: "cancelled" });
    const throwing = createNativeShareExport({
      sharedAction: "sharedAction",
      dismissedAction: "dismissedAction",
      async share(): Promise<{ action: string }> {
        throw new Error("user bailed");
      },
    });
    expect(await throwing.export({ svg: "", summary: "s", fileName: "f" })).toEqual({ status: "cancelled" });
  });

  it("poster bytes flow into a dataURL when cache + fs are present", async () => {
    const storage = new InMemoryStorage();
    await storage.persistAll(COLLECTIONS.records, [makeRecord({ posterPath: "/p.jpg" })]);
    const seen: string[] = [];
    const command = createSharePosterCommand({
      storage,
      imageCache: {
        async resolve() { return "/cache/abc.jpg"; },
        async clear() {},
      },
      fs: { async readFile() { return new Uint8Array([1, 2, 3]); } },
      exportPort: {
        async export(input): Promise<ShareResult> {
          seen.push(input.svg);
          return { status: "downloaded" };
        },
      },
    });
    await command("rec-1");
    expect(seen[0]).toContain(`href="data:image/jpeg;base64,${Buffer.from([1, 2, 3]).toString("base64")}"`);
  });
});

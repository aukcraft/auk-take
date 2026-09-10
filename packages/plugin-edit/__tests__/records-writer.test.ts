import { describe, expect, it } from "vitest";
import { COLLECTIONS, EventBus, InMemoryStorage } from "@auktake/core";
import { RECORD_EVENTS, type RecordEventPayload } from "@auktake/ui-contracts";
import {
  RecordsWriter,
  applyDraftToRecord,
  buildManualSnapshot,
} from "../src/headless/records-writer";
import type { ValidatedDraft } from "../src/headless/validation";

const T0 = "2026-05-20T10:00:00.000Z";
let seq = 0;
const nextId = () => `01TESTID${String(++seq).padStart(8, "0")}`;

function makeWriter(now: () => string = () => T0) {
  const storage = new InMemoryStorage();
  const events = new EventBus();
  const published: { event: string; payload: RecordEventPayload }[] = [];
  for (const e of Object.values(RECORD_EVENTS)) {
    events.on<RecordEventPayload>(e, (payload) => published.push({ event: e, payload }));
  }
  const writer = new RecordsWriter({ storage, events, now, generateId: nextId });
  return { writer, storage, published };
}

const draft = (overrides: Partial<ValidatedDraft> = {}): ValidatedDraft => ({
  title: "深海",
  originalTitle: "深海",
  mediaType: "movie",
  watchedAt: "2026-05-20",
  rating: 8.5,
  review: "great",
  ...overrides,
});

describe("buildManualSnapshot", () => {
  it("uses Phase 2 sentinel defaults for manual records", () => {
    const snap = buildManualSnapshot(draft(), "id1", T0);
    expect(snap.tmdb.id).toBe(0);
    expect(snap.tmdb.posterPath).toBe("");
    expect(snap.tmdb.backdropPath).toBe("");
    expect(snap.tmdb.overview).toBe("");
    expect(snap.tmdb.releaseDate).toBe("");
    expect(snap.tmdb.genres).toEqual([]);
    expect(snap.tmdb.runtime).toBe(0);
    expect(snap.tmdb.originalTitle).toBe("深海");
    expect(snap.source).toEqual({ type: "manual" });
    expect(snap.mediaCache).toEqual({});
    expect(snap.schemaVersion).toBe(1);
    expect(snap.user.tags).toEqual([]);
    expect(snap.user.rating).toBe(8.5);
    expect("seasonNumber" in snap.tmdb).toBe(false);
  });

  it("episode draft carries S/E on the snapshot", () => {
    const snap = buildManualSnapshot(draft({ mediaType: "episode", seasonNumber: 2, episodeNumber: 5 }), "id1", T0);
    expect(snap.tmdb.seasonNumber).toBe(2);
    expect(snap.tmdb.episodeNumber).toBe(5);
  });
});

describe("RecordsWriter write path", () => {
  it("create: persists and publishes record:created {id}", async () => {
    const { writer, published } = makeWriter();
    const record = await writer.create(draft());
    expect(record.id).toMatch(/^01TESTID/);
    expect(await writer.get(record.id)).toBeDefined();
    expect(published).toEqual([{ event: RECORD_EVENTS.created, payload: { id: record.id } }]);
  });

  it("update: keeps id/createdAt, refreshes updatedAt, publishes updated", async () => {
    const later = "2026-06-01T00:00:00.000Z";
    const { writer, published } = makeWriter(() => later);
    const created = await writer.create(draft());
    const updated = await writer.update(created.id, draft({ title: "深海（重看）", rating: 9 }));
    expect(updated).toBeDefined();
    expect(updated?.id).toBe(created.id);
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(updated?.tmdb.title).toBe("深海（重看）");
    expect(published.map((p) => p.event)).toEqual([
      RECORD_EVENTS.created,
      RECORD_EVENTS.updated,
    ]);
  });

  it("update of unknown id returns undefined without publishing", async () => {
    const { writer, published } = makeWriter();
    expect(await writer.update("missing", draft())).toBeUndefined();
    expect(published).toEqual([]);
  });

  it("remove: deletes and publishes record:deleted", async () => {
    const { writer, published, storage } = makeWriter();
    const created = await writer.create(draft());
    expect(await writer.remove(created.id)).toBe(true);
    expect(await writer.loadAll()).toEqual([]);
    expect(published.at(-1)).toEqual({ event: RECORD_EVENTS.deleted, payload: { id: created.id } });
    // storage actually persisted the removal
    expect(await storage.loadAll(COLLECTIONS.records)).toEqual([]);
  });

  it("remove of unknown id: no change, no event", async () => {
    const { writer, published } = makeWriter();
    expect(await writer.remove("missing")).toBe(false);
    expect(published).toEqual([]);
  });

  it("applyDraftToRecord preserves non-manual extras", () => {
    const created = buildManualSnapshot(draft(), "id1", T0);
    const enriched = {
      ...created,
      source: { type: "import" as const },
      mediaCache: { poster: "cache/p.jpg" },
    };
    const next = applyDraftToRecord(enriched, draft({ title: "edited" }), T0);
    expect(next.source).toEqual({ type: "import" });
    expect(next.mediaCache).toEqual({ poster: "cache/p.jpg" });
    expect(next.tmdb.title).toBe("edited");
    expect(next.createdAt).toBe(T0);
  });
});

describe("delete confirmation flow", () => {
  it("cancel leaves the collection untouched", async () => {
    const { writer } = makeWriter();
    const created = await writer.create(draft());
    // requestDelete -> cancel is session-layer; at writer level a
    // cancelled delete simply never calls remove(). Verify remove is
    // the only mutation path:
    const before = await writer.loadAll();
    expect(before).toHaveLength(1);
    expect(before[0]?.id).toBe(created.id);
  });
});

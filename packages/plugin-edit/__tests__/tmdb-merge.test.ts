import { describe, expect, it } from "vitest";
import { COLLECTIONS, EventBus, InMemoryStorage, type MovieRecord } from "@auktake/core";
import { RECORD_EVENTS } from "@auktake/ui-contracts";
import {
  RecordsWriter,
  applyTmdbSnapshotToRecord,
  buildManualSnapshot,
  mergeTmdb,
} from "../src/headless/records-writer";
import { EditSessionController } from "../src/headless/edit-session";
import type { ValidatedDraft } from "../src/headless/validation";

const T0 = "2026-05-20T10:00:00.000Z";
let seq = 0;

function makeWriter() {
  const storage = new InMemoryStorage();
  const events = new EventBus();
  const published: { event: string; payload: { id: string } }[] = [];
  for (const e of Object.values(RECORD_EVENTS)) {
    events.on(e, (p: { id: string }) => published.push({ event: e, payload: p }));
  }
  const writer = new RecordsWriter({
    storage,
    events,
    now: () => T0,
    generateId: () => `01TEST${String(++seq).padStart(10, "0")}`,
  });
  return { writer, storage, published };
}

const draft = (overrides: Partial<ValidatedDraft> = {}): ValidatedDraft => ({
  title: "深海",
  originalTitle: "深海",
  mediaType: "movie",
  watchedAt: "2026-05-20",
  rating: 8.5,
  review: "",
  ...overrides,
});

const snapshot = (overrides: Partial<MovieRecord["tmdb"]> = {}): MovieRecord["tmdb"] => ({
  id: 12345,
  mediaType: "movie",
  title: "深海",
  originalTitle: "深海 Seven",
  overview: "animated deep sea journey",
  posterPath: "/poster.jpg",
  backdropPath: "/bg.jpg",
  releaseDate: "2023-01-19",
  genres: [{ id: 16, name: "动画" }],
  runtime: 112,
  ...overrides,
});

describe("mergeTmdb semantics", () => {
  it("staged snapshot fully replaces the sentinel", () => {
    const base = buildManualSnapshot(draft(), "id1", T0);
    const merged = mergeTmdb(base, base, { keep: false, snapshot: snapshot() });
    expect(merged.tmdb.id).toBe(12345);
    expect(merged.tmdb.genres).toHaveLength(1);
    expect(merged.tmdb.runtime).toBe(112);
    expect(merged.tmdb.posterPath).toBe("/poster.jpg");
  });

  it("keep directive preserves an existing binding through a plain edit", () => {
    const bound = { ...buildManualSnapshot(draft(), "id1", T0), tmdb: snapshot() };
    const reEdited = buildManualSnapshot(draft({ rating: 9 }), "id1", T0);
    const merged = mergeTmdb(reEdited, bound, { keep: true });
    expect(merged.tmdb.id).toBe(12345);
  });

  it("fallback (no directive) leaves the manual sentinel intact", () => {
    const base = buildManualSnapshot(draft(), "id1", T0);
    const merged = mergeTmdb(base, base, { keep: false });
    expect(merged.tmdb.id).toBe(0);
    expect(merged.tmdb.posterPath).toBe("");
  });
});

describe("RecordsWriter Phase 2 paths", () => {
  it("create with staged snapshot persists a bound record", async () => {
    const { writer, published } = makeWriter();
    const record = await writer.create(draft(), snapshot());
    expect(record.tmdb.id).toBe(12345);
    expect(published[0]?.event).toBe(RECORD_EVENTS.created);
  });

  it("update with unbind directive falls back to sentinel values", async () => {
    const { writer } = makeWriter();
    const created = await writer.create(draft(), snapshot());
    const updated = await writer.update(created.id, draft({ rating: 9 }), {
      keep: false,
      unbind: true,
    });
    expect(updated?.tmdb.id).toBe(0);
    expect(updated?.tmdb.posterPath).toBe("");
    expect(updated?.user.rating).toBe(9);
  });

  it("plain update keeps binding and only changes user fields", async () => {
    const { writer } = makeWriter();
    const created = await writer.create(draft(), snapshot());
    const updated = await writer.update(created.id, draft({ rating: 9 }));
    expect(updated?.tmdb.id).toBe(12345);
    expect(updated?.user.rating).toBe(9);
    expect(updated?.createdAt).toBe(created.createdAt);
  });

  it("applyTmdb replaces ONLY the snapshot and publishes updated", async () => {
    const { writer, published } = makeWriter();
    const created = await writer.create(draft());
    const before: MovieRecord = JSON.parse(JSON.stringify(created));
    const applied = await writer.applyTmdb(created.id, snapshot());
    expect(applied?.tmdb.id).toBe(12345);
    expect(applied?.user).toEqual(before.user);
    expect(applied?.createdAt).toBe(before.createdAt);
    expect(applied?.id).toBe(before.id);
    expect(published.at(-1)).toEqual({
      event: RECORD_EVENTS.updated,
      payload: { id: created.id },
    });
  });

  it("applyTmdbSnapshotToRecord clears stale mediaCache", () => {
    const record = buildManualSnapshot(draft(), "id1", T0);
    const withCache = { ...record, mediaCache: { poster: "/old.png" } };
    const next = applyTmdbSnapshotToRecord(withCache, snapshot(), T0);
    expect(next.mediaCache).toEqual({});
  });

  it("warmMediaCache writes poster path and re-publishes updated", async () => {
    const { writer, published, storage } = makeWriter();
    const created = await writer.create(draft(), snapshot());
    await writer.warmMediaCache(created.id, "https://image.tmdb.org/x.jpg", async (url) =>
      url.includes("x.jpg") ? "/cache/abc.img" : null,
    );
    const rows = await storage.loadAll<MovieRecord>(COLLECTIONS.records);
    expect(rows[0]?.mediaCache.poster).toBe("/cache/abc.img");
    expect(published.at(-1)?.event).toBe(RECORD_EVENTS.updated);
  });
});

describe("EditSessionController pendingTmdb", () => {
  it("openRecord stages the snapshot for bound records only", () => {
    const session = new EditSessionController();
    const bound = { ...buildManualSnapshot(draft(), "id1", T0), tmdb: snapshot() };
    session.openRecord(bound);
    expect(session.getState().pendingTmdb?.id).toBe(12345);

    session.openRecord(buildManualSnapshot(draft(), "id2", T0));
    expect(session.getState().pendingTmdb).toBeNull();
  });

  it("setPendingTmdb stages; unbindTmdb clears and flags", () => {
    const session = new EditSessionController();
    session.openNew("2026-05-20");
    session.setPendingTmdb(snapshot());
    expect(session.getState().pendingTmdb).not.toBeNull();
    session.unbindTmdb();
    expect(session.getState().pendingTmdb).toBeNull();
    expect(session.getState().unbound).toBe(true);
  });
});

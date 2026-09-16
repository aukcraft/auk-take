import { describe, expect, it } from "vitest";
import { EventBus, InMemoryStorage, type MoodEntry, type MovieRecord } from "@auktake/core";
import { MOOD_EVENTS } from "@auktake/ui-contracts";
import { MoodStore, moodTimeline, reviewCards } from "../src/headless/mood-store";

function makeRecord(id: string, title: string, review = ""): MovieRecord {
  return {
    id,
    schemaVersion: 1,
    tmdb: {
      id: 0,
      mediaType: "movie",
      title,
      originalTitle: title,
      overview: "",
      posterPath: "",
      backdropPath: "",
      releaseDate: "",
      genres: [],
      runtime: 0,
    },
    user: { watchedAt: "2026-05-01", rating: 0, review, tags: [] },
    source: { type: "manual" },
    mediaCache: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeStore() {
  const storage = new InMemoryStorage();
  const events = new EventBus();
  let n = 0;
  let t = 0;
  const store = new MoodStore(
    storage,
    events,
    () => `id-${++n}`,
    () => new Date(Date.UTC(2026, 4, 1, ++t)).toISOString(),
  );
  return { store, storage, events };
}

describe("MoodStore", () => {
  it("appends entries and emits mood:created with the entry id", async () => {
    const { store, events } = makeStore();
    const emitted: string[] = [];
    events.on<{ id: string }>(MOOD_EVENTS.created, (p) => emitted.push(p.id));
    const entry = await store.add("rec-1", "love", "  看哭了  ");
    expect(entry).toMatchObject({ id: "id-1", recordId: "rec-1", mood: "love", note: "看哭了" });
    expect(emitted).toEqual(["id-1"]);
    expect(await store.list()).toHaveLength(1);
  });

  it("history semantics: re-mooding a record appends, never overwrites", async () => {
    const { store } = makeStore();
    await store.add("rec-1", "meh");
    await store.add("rec-1", "love", "二刷真香");
    const all = await store.list();
    expect(all.map((e) => e.mood)).toEqual(["meh", "love"]);
    expect(all[0]!.id).not.toBe(all[1]!.id);
  });

  it("blank note is dropped from the entry", async () => {
    const { store } = makeStore();
    const entry = await store.add("rec-1", "ok", "   ");
    expect("note" in entry).toBe(false);
  });
});

describe("moodTimeline selector", () => {
  it("joins entries with record titles, newest first", async () => {
    const { store } = makeStore();
    await store.add("r1", "ok", "早");
    await store.add("r2", "sad", "晚");
    const entries = await store.list();
    const timeline = moodTimeline(entries, [makeRecord("r1", "深海"), makeRecord("r2", "沙丘")]);
    expect(timeline.map((i) => [i.title, i.entry.mood])).toEqual([
      ["沙丘", "sad"],
      ["深海", "ok"],
    ]);
    expect(timeline.every((i) => !i.recordMissing)).toBe(true);
  });

  it("degraded title when the record is gone", async () => {
    const { store } = makeStore();
    await store.add("gone", "love");
    const [item] = moodTimeline(await store.list(), []);
    expect(item!.recordMissing).toBe(true);
    expect(item!.title).toContain("已删除");
  });
});

describe("reviewCards selector", () => {
  it("keeps only non-empty reviews, newest watched first", () => {
    const cards = reviewCards([
      makeRecord("a", "无评"),
      makeRecord("b", "有评", "好看"),
      { ...makeRecord("c", "更新", "赞"), user: { watchedAt: "2026-06-01", rating: 8, review: "赞", tags: [] } },
      makeRecord("d", "空白", "   "),
    ]);
    expect(cards.map((r) => r.tmdb.title)).toEqual(["更新", "有评"]);
  });
});

describe("MoodEntry schema fixture sanity", () => {
  it("matches the core MoodEntry shape (recordId/mood/createdAt)", async () => {
    const { store } = makeStore();
    const entry: MoodEntry = await store.add("rec-1", "bored");
    expect(Object.keys(entry).sort()).toEqual(
      ["createdAt", "id", "mood", "recordId", "schemaVersion"].sort(),
    );
  });
});

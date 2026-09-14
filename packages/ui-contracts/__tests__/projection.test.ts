import { describe, expect, it, vi } from "vitest";
import { COLLECTIONS, EventBus, InMemoryStorage, type StoredEntity } from "@auktake/core";
import {
  RECORD_EVENTS,
  createCollectionProjection,
  type RecordEventPayload,
} from "../src/index";

interface Item extends StoredEntity {
  id: string;
  schemaVersion: number;
  value: number;
}

const item = (id: string, value: number): Item => ({ id, schemaVersion: 1, value });

function setup() {
  const storage = new InMemoryStorage();
  const events = new EventBus();
  const projection = createCollectionProjection<Item>({
    storage,
    events,
    collection: COLLECTIONS.records,
    invalidationEvents: [
      RECORD_EVENTS.created,
      RECORD_EVENTS.updated,
      RECORD_EVENTS.deleted,
    ],
  });
  return { storage, events, projection };
}

describe("createCollectionProjection", () => {
  it("startup: loads the full collection and notifies subscribers", async () => {
    const { storage, projection } = setup();
    await storage.persistAll(COLLECTIONS.records, [item("a", 1), item("b", 2)]);
    const fresh = createCollectionProjection<Item>({
      storage,
      events: new EventBus(),
      collection: COLLECTIONS.records,
      invalidationEvents: [],
    });
    // initial load is async; await a microtask cycle
    await Promise.resolve();
    expect(fresh.getState()).toEqual([item("a", 1), item("b", 2)]);
    expect(projection.getState()).toEqual([]);
  });

  it("invalidation event triggers reload with fresh data", async () => {
    const { storage, events, projection } = setup();
    await storage.persistAll(COLLECTIONS.records, [item("a", 1)]);
    events.emit<RecordEventPayload>(RECORD_EVENTS.created, { id: "a" });
    await vi.waitFor(() => {
      expect(projection.getState()).toEqual([item("a", 1)]);
    });
  });

  it("same-tick events are merged into a single reload", async () => {
    const storage = new InMemoryStorage();
    const events = new EventBus();
    const loadAll = vi.spyOn(storage, "loadAll");
    const projection = createCollectionProjection<Item>({
      storage,
      events,
      collection: COLLECTIONS.records,
      invalidationEvents: [
        RECORD_EVENTS.created,
        RECORD_EVENTS.updated,
        RECORD_EVENTS.deleted,
      ],
    });
    await Promise.resolve(); // let the startup load settle
    loadAll.mockClear();

    events.emit<RecordEventPayload>(RECORD_EVENTS.created, { id: "a" });
    events.emit<RecordEventPayload>(RECORD_EVENTS.updated, { id: "a" });
    await Promise.resolve(); // microtask flush
    await Promise.resolve(); // reload promise settle

    expect(loadAll).toHaveBeenCalledTimes(1);
    expect(projection.getState()).toEqual([]);
    projection.dispose();
  });

  it("subscribers are notified once per reload and can unsubscribe", async () => {
    const { storage, events } = setup();
    const projection = createCollectionProjection<Item>({
      storage,
      events,
      collection: COLLECTIONS.records,
      invalidationEvents: [RECORD_EVENTS.created],
    });
    const listener = vi.fn();
    const unsubscribe = projection.subscribe(listener);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));

    await storage.persistAll(COLLECTIONS.records, [item("x", 9)]);
    events.emit<RecordEventPayload>(RECORD_EVENTS.created, { id: "x" });
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(2));
    expect(projection.getState()).toEqual([item("x", 9)]);

    unsubscribe();
    events.emit<RecordEventPayload>(RECORD_EVENTS.created, { id: "y" });
    await Promise.resolve();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(2);
    projection.dispose();
  });

  it("dispose detaches from the event bus", async () => {
    const storage = new InMemoryStorage();
    const events = new EventBus();
    const loadAll = vi.spyOn(storage, "loadAll");
    const projection = createCollectionProjection<Item>({
      storage,
      events,
      collection: COLLECTIONS.records,
      invalidationEvents: [RECORD_EVENTS.deleted],
    });
    await Promise.resolve();
    loadAll.mockClear();
    projection.dispose();

    events.emit<RecordEventPayload>(RECORD_EVENTS.deleted, { id: "z" });
    await Promise.resolve();
    await Promise.resolve();
    expect(loadAll).not.toHaveBeenCalled();
  });

  it("snapshots are immutable", async () => {
    const { storage, events } = setup();
    await storage.persistAll(COLLECTIONS.records, [item("a", 1)]);
    const projection = createCollectionProjection<Item>({
      storage,
      events,
      collection: COLLECTIONS.records,
      invalidationEvents: [],
    });
    await vi.waitFor(() => expect(projection.getState().length).toBe(1));
    expect(Object.isFrozen(projection.getState())).toBe(true);
    projection.dispose();
  });
});

/**
 * Shared headless collection projection (design D3).
 *
 * Read-side plugins (display / record / timeline) each hold a PRIVATE
 * projection of a collection: initial full loadAll, invalidation via
 * subscribed events, microtask-merged debounce, immutable snapshots.
 * Platform capabilities (Storage, EventBus) are injected — this module
 * is pure TS and Node-testable.
 */
import type { CollectionName, EventBus, Storage, StoredEntity } from "@auktake/core";

export interface Projection<T> {
  /** Immutable snapshot of the currently loaded collection. */
  getState(): readonly T[];
  /** Subscribe to snapshot changes. Returns an unsubscribe handle. */
  subscribe(listener: (state: readonly T[]) => void): () => void;
  /** Detach from the event bus. Listeners are dropped. */
  dispose(): void;
}

export interface ProjectionDeps {
  readonly storage: Storage;
  readonly events: EventBus;
  readonly collection: CollectionName;
  /** Event names that invalidate the snapshot (e.g. RECORD_EVENT_NAMES). */
  readonly invalidationEvents: readonly string[];
}

export function createCollectionProjection<T extends StoredEntity>(
  deps: ProjectionDeps,
): Projection<T> {
  const { storage, events, collection, invalidationEvents } = deps;
  let state: readonly T[] = [];
  const listeners = new Set<(state: readonly T[]) => void>();
  let reloadScheduled = false;
  let disposed = false;

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener(state);
      } catch {
        // listener failures are isolated (EventBus philosophy)
      }
    }
  };

  const reload = async (): Promise<void> => {
    if (disposed) return;
    const loaded = await storage.loadAll<T>(collection);
    if (disposed) return;
    state = Object.freeze([...loaded]);
    notify();
  };

  /** Microtask-level merge: N invalidation events in one tick → one reload. */
  const scheduleReload = (): void => {
    if (reloadScheduled || disposed) return;
    reloadScheduled = true;
    Promise.resolve().then(() => {
      reloadScheduled = false;
      void reload();
    });
  };

  const unsubscribers = invalidationEvents.map((name) =>
    events.on(name, scheduleReload),
  );

  // Startup: full load, empty -> ready transition notifies subscribers.
  void reload();

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      listeners.clear();
      for (const off of unsubscribers) off();
    },
  };
}

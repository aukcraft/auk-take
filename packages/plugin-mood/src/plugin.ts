/**
 * plugin-mood factory (design D1/D2): recommended tier, mood-entries
 * sole writer. Registers the mood composer command + overlay and the
 * read tab content (mood timeline + review reading).
 */
import {
  COLLECTIONS,
  type AukPlugin,
  type MoodEntry,
  type MovieRecord,
  type Storage,
} from "@auktake/core";
import { ulid } from "ulid";
import {
  CAPABILITY_KEYS,
  MOOD_EVENTS,
  RECORD_EVENT_NAMES,
  STORAGE_SERVICE,
  createCollectionProjection,
  type MoodAddCommand,
  type PluginRuntimeDeps,
} from "@auktake/ui-contracts";
import { TAB_CAPABILITY_KEYS } from "@auktake/ui-nav";
import { MoodStore } from "./headless/mood-store";
import { MoodUiStore } from "./headless/ui-store";
import { createMoodOverlay } from "./components/MoodOverlay";
import { createReadView } from "./components/ReadView";

export function createMoodPlugin(deps: PluginRuntimeDeps): AukPlugin {
  return {
    id: "mood",
    tier: "recommended",
    permissions: ["storage:read", "storage:write"],

    async connect() {
      return { state: {} };
    },

    create() {
      const storage = deps.services.require<Storage>(STORAGE_SERVICE);
      const store = new MoodStore(storage, deps.events, ulid, () => new Date().toISOString());
      const ui = new MoodUiStore();

      const records = createCollectionProjection<MovieRecord>({
        storage,
        events: deps.events,
        collection: COLLECTIONS.records,
        invalidationEvents: RECORD_EVENT_NAMES,
      });
      const moods = createCollectionProjection<MoodEntry>({
        storage,
        events: deps.events,
        collection: COLLECTIONS.moodEntries,
        invalidationEvents: [MOOD_EVENTS.created],
      });

      const moodAdd: MoodAddCommand = (recordId) => ui.openComposer(recordId);
      deps.capabilities.register(CAPABILITY_KEYS.moodAdd, moodAdd);
      deps.capabilities.register(
        CAPABILITY_KEYS.overlayMood,
        createMoodOverlay(ui, records, async (recordId, mood, note) => {
          await store.add(recordId, mood, note);
        }),
      );
      deps.capabilities.register(
        TAB_CAPABILITY_KEYS.read,
        createReadView(records, moods),
      );

      return {
        store,
        dispose() {
          deps.capabilities.unregister(CAPABILITY_KEYS.moodAdd);
          deps.capabilities.unregister(CAPABILITY_KEYS.overlayMood);
          deps.capabilities.unregister(TAB_CAPABILITY_KEYS.read);
          records.dispose();
          moods.dispose();
        },
      };
    },
  };
}

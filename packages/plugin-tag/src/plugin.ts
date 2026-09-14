/**
 * plugin-tag factory (design D1/D2): locked tier, tags sole writer.
 * Registers the tag command family + picker component; destructive
 * operations route reference cleanup through edit's internal channel.
 */
import type { AukPlugin, Storage } from "@auktake/core";
import { ulid } from "ulid";
import {
  CAPABILITY_KEYS,
  STORAGE_SERVICE,
  type PluginRuntimeDeps,
  type RecordRemoveTagCommand,
  type Tag,
  type TagCreateCommand,
  type TagDeleteCommand,
  type TagListCommand,
  type TagRenameCommand,
} from "@auktake/ui-contracts";
import { TagStore } from "./headless/tag-store";
import { createTagPicker } from "./components/TagPicker";

/** Live tag snapshot with a change-notification subscription. */
class TagIndex {
  private tags: Tag[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(private readonly store: TagStore) {}

  refresh = async (): Promise<void> => {
    this.tags = await this.store.list();
    for (const l of [...this.listeners]) {
      try {
        l();
      } catch {
        // isolated
      }
    }
  };

  get snapshot(): Tag[] {
    return this.tags;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

export function createTagPlugin(deps: PluginRuntimeDeps): AukPlugin {
  return {
    id: "tag",
    tier: "locked",
    permissions: ["storage:read", "storage:write"],

    async connect() {
      return { state: {} };
    },

    create() {
      const storage = deps.services.require<Storage>(STORAGE_SERVICE);
      const store = new TagStore({
        storage,
        events: deps.events,
        now: () => new Date().toISOString(),
        generateId: ulid,
      });
      const index = new TagIndex(store);
      void index.refresh();

      const removeTagReferences = deps.capabilities.get<RecordRemoveTagCommand>(
        CAPABILITY_KEYS.recordRemoveTag,
      );
      if (removeTagReferences === undefined && deps.dev) {
        console.warn(
          `[tag] destructive ops degraded: "${CAPABILITY_KEYS.recordRemoveTag}" not registered (edit plugin not loaded)`,
        );
      }

      const list: TagListCommand = () => index.snapshot;
      const create: TagCreateCommand = async (name) => {
        const tag = await store.create(name);
        await index.refresh();
        return tag;
      };
      const rename: TagRenameCommand = async (id, name) => {
        const tag = await store.rename(id, name);
        await index.refresh();
        return tag;
      };
      const remove: TagDeleteCommand = async (id) => {
        if (!removeTagReferences) {
          throw new Error("无法清理记录引用（编辑器未加载），拒绝删除");
        }
        await store.delete(id, removeTagReferences);
        await index.refresh();
      };

      deps.capabilities.register(CAPABILITY_KEYS.tagList, list);
      deps.capabilities.register(CAPABILITY_KEYS.tagCreate, create);
      deps.capabilities.register(CAPABILITY_KEYS.tagRename, rename);
      deps.capabilities.register(CAPABILITY_KEYS.tagDelete, remove);
      deps.capabilities.register(
        CAPABILITY_KEYS.tagPicker,
        createTagPicker(() => index.snapshot, index.subscribe),
      );
      // keep the index fresh for tag:* changes from ANY writer path
      for (const event of ["tag:created", "tag:renamed", "tag:deleted"] as const) {
        deps.events.on(event, () => void index.refresh());
      }

      return {
        store,
        index,
        dispose() {
          deps.capabilities.unregister(CAPABILITY_KEYS.tagList);
          deps.capabilities.unregister(CAPABILITY_KEYS.tagCreate);
          deps.capabilities.unregister(CAPABILITY_KEYS.tagRename);
          deps.capabilities.unregister(CAPABILITY_KEYS.tagDelete);
          deps.capabilities.unregister(CAPABILITY_KEYS.tagPicker);
        },
      };
    },
  };
}

/**
 * tags collection sole writer (spec: plugin-tag "tags 集合唯一写入方").
 * CRUD with duplicate rejection (case/space-insensitive), rename keeps
 * id, delete orchestrates reference cleanup through the edit channel.
 * Pure headless — Storage/EventBus/clock/id injected.
 */
import { COLLECTIONS, type EventBus, type Storage } from "@auktake/core";
import { TAG_EVENTS, type Tag, type TagEventPayload } from "@auktake/ui-contracts";

export interface TagEntity extends Tag {
  readonly id: string;
  readonly schemaVersion: number;
  readonly name: string;
}

export interface TagStoreDeps {
  readonly storage: Storage;
  readonly events: EventBus;
  readonly now: () => string;
  readonly generateId: () => string;
}

/** Normalize for duplicate detection: trim + collapse spaces + lowercase. */
export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export class TagStore {
  private readonly deps: TagStoreDeps;

  constructor(deps: TagStoreDeps) {
    this.deps = deps;
  }

  private async loadAll(): Promise<TagEntity[]> {
    return this.deps.storage.loadAll<TagEntity>(COLLECTIONS.tags);
  }

  private async persistAll(tags: TagEntity[]): Promise<void> {
    await this.deps.storage.persistAll(COLLECTIONS.tags, tags);
  }

  private emit(event: string, id: string): void {
    this.deps.events.emit<TagEventPayload>(event, { id });
  }

  /** Snapshot sorted by name (locale-aware, spec: 列表按名排序). */
  async list(): Promise<TagEntity[]> {
    const tags = await this.loadAll();
    return [...tags].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  }

  async create(rawName: string): Promise<TagEntity> {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length === 0) throw new Error("标签名不能为空");
    const tags = await this.loadAll();
    if (tags.some((t) => normalizeTagName(t.name) === normalizeTagName(name))) {
      throw new Error(`标签「${name}」已存在`);
    }
    const tag: TagEntity = {
      id: this.deps.generateId(),
      schemaVersion: 1,
      name,
    };
    await this.persistAll([...tags, tag]);
    this.emit(TAG_EVENTS.created, tag.id);
    return tag;
  }

  async rename(id: string, rawName: string): Promise<TagEntity> {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length === 0) throw new Error("标签名不能为空");
    const tags = await this.loadAll();
    const index = tags.findIndex((t) => t.id === id);
    if (index < 0) throw new Error(`标签不存在: ${id}`);
    if (tags.some((t) => t.id !== id && normalizeTagName(t.name) === normalizeTagName(name))) {
      throw new Error(`标签「${name}」已存在`);
    }
    const next = [...tags];
    const renamed: TagEntity = { ...tags[index]!, name };
    next[index] = renamed;
    await this.persistAll(next);
    this.emit(TAG_EVENTS.renamed, id);
    return renamed;
  }

  /**
   * Delete a tag. Reference cleanup runs through the injected edit
   * channel; when the channel is unavailable the delete is REFUSED
   * (records would keep dangling references otherwise).
   */
  async delete(
    id: string,
    removeTagReferences: (tagId: string) => Promise<number>,
  ): Promise<{ removedRecords: number }> {
    const tags = await this.loadAll();
    if (!tags.some((t) => t.id === id)) throw new Error(`标签不存在: ${id}`);
    const removedRecords = await removeTagReferences(id);
    await this.persistAll(tags.filter((t) => t.id !== id));
    this.emit(TAG_EVENTS.deleted, id);
    return { removedRecords };
  }
}

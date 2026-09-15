/**
 * Cross-plugin capability keys and event names: single source of truth.
 *
 * Providers and consumers MUST reference these constants instead of
 * string literals, so key drift is not expressible at compile time
 * (spec: ui-contracts "能力 key 与事件名单一来源").
 */

/** Function/component capability keys registered in the CapabilityRegistry. */
export const CAPABILITY_KEYS = {
  /** edit plugin: open the record editor (new or existing). */
  recordEdit: "cmd:record-edit",
  /** edit plugin: request deletion of a record (with confirmation). */
  recordDelete: "cmd:record-delete",
  /** display plugin: open the read-only record detail view. */
  recordDetail: "cmd:record-detail",
  /** timeline plugin: the timeline view component consumed by display. */
  viewTimeline: "ui:view:timeline",
  /** edit plugin: global overlay root component (editor modal). */
  overlayRoot: "ui:overlay:root",
  /** display plugin: global read-only detail overlay component. */
  overlayRecordDetail: "ui:overlay:record-detail",
  /** tmdb plugin: search TMDB for candidates (Phase 2). */
  tmdbSearch: "cmd:tmdb-search",
  /** tmdb plugin: backfill one sentinel record (Phase 2). */
  tmdbBackfill: "cmd:tmdb-backfill",
  /** tmdb plugin: open the credential/language config dialog. */
  tmdbConfigure: "cmd:tmdb-configure",
  /** tmdb plugin: global backfill review overlay component. */
  overlayTmdbBackfill: "ui:overlay:tmdb-backfill",
  /** edit plugin (internal channel): merge a TMDB snapshot into a record. */
  recordApplyTmdb: "cmd:record-apply-tmdb",
  /** edit plugin (internal channel): strip a tag id from ALL records. */
  recordRemoveTag: "cmd:record-remove-tag",
  /** tag plugin: list all tags sorted by name. */
  tagList: "cmd:tag-list",
  /** tag plugin: create a tag (name) — rejects duplicates. */
  tagCreate: "cmd:tag-create",
  /** tag plugin: rename a tag, id preserved. */
  tagRename: "cmd:tag-rename",
  /** tag plugin: delete a tag (records cleaned via edit channel). */
  tagDelete: "cmd:tag-delete",
  /** tag plugin: tag picker component for the editor form. */
  tagPicker: "ui:tag-picker",
  /** search plugin: run a RecordQuery, get matching records. */
  search: "cmd:search",
  /** search plugin: toolbar component consumed by the records tab. */
  searchToolbar: "ui:search-toolbar",
  /** jellyfin plugin: manual incremental sync of watch history. */
  jellyfinSync: "cmd:jellyfin-sync",
  /** jellyfin plugin: open the server/credential config dialog. */
  jellyfinConfigure: "cmd:jellyfin-configure",
  /** jellyfin plugin: global config overlay component. */
  overlayJellyfin: "ui:overlay:jellyfin",
  /** edit plugin (internal channel): bulk-import jellyfin records. */
  recordApplyJellyfin: "cmd:record-apply-jellyfin",
  /** tmdb plugin: resolve a picked candidate into a full TmdbSnapshot. */
  tmdbCandidateSnapshot: "cmd:tmdb-candidate-snapshot",
  /** tmdb plugin: sync credential status probe (configured or not). */
  tmdbStatus: "cmd:tmdb-status",
} as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[keyof typeof CAPABILITY_KEYS];

/**
 * Overlay capability keys rendered by the host shells' generic overlay
 * host. The shells iterate this list and stay plugin-agnostic; an
 * unregistered key simply renders nothing.
 */
export const OVERLAY_KEYS: readonly CapabilityKey[] = [
  CAPABILITY_KEYS.overlayRoot,
  CAPABILITY_KEYS.overlayRecordDetail,
  CAPABILITY_KEYS.overlayTmdbBackfill,
  CAPABILITY_KEYS.overlayJellyfin,
];

/** Jellyfin sync progress events published by the jellyfin plugin (Phase 4 batched sync). */
export const JELLYFIN_EVENTS = {
  /** Emitted after each committed batch; payload: JellyfinSyncProgress. */
  syncProgress: "jellyfin:sync-progress",
} as const;

/** Tag collection change events published by the tag plugin (sole writer). */
export const TAG_EVENTS = {
  created: "tag:created",
  renamed: "tag:renamed",
  deleted: "tag:deleted",
} as const;

/** Record collection change events published by the edit plugin (sole writer). */
export const RECORD_EVENTS = {
  created: "record:created",
  updated: "record:updated",
  deleted: "record:deleted",
} as const;

/** All record mutation events — the invalidation set for read-side projections. */
export const RECORD_EVENT_NAMES: readonly string[] = [
  RECORD_EVENTS.created,
  RECORD_EVENTS.updated,
  RECORD_EVENTS.deleted,
];

/** ServiceRegistry name under which both shells register the Storage port. */
export const STORAGE_SERVICE = "storage";

/** ServiceRegistry name for the poster image cache (optional, Phase 2). */
export const IMAGE_CACHE_SERVICE = "svc:image-cache";

/** ServiceRegistry name for the shared HTTP wrapper (Phase 4). */
export const HTTP_SERVICE = "svc:http";

/** ServiceRegistry name for a binary fs port (optional; desktop only). */
export const FS_SERVICE = "fs";

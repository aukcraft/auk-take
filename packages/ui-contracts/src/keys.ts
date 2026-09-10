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
];

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

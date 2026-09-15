/**
 * Phase 3 contract types: tag commands, the tag picker component
 * props, and the search query object. Pure types — zero platform deps.
 */
import type { MovieRecord } from "@auktake/core";
import type * as React from "react";

/** Core Tag shape re-exported for consumers (id + name, Phase 0 schema). */
export type Tag = { readonly id: string; readonly schemaVersion: number; readonly name: string };

/** cmd:tag-list — snapshot of all tags, sorted by name (locale-aware). */
export type TagListCommand = () => readonly Tag[];

/** cmd:tag-create — throws/rejects on duplicate (case/space-insensitive). */
export type TagCreateCommand = (name: string) => Promise<Tag>;

/** cmd:tag-rename — id preserved; references unchanged. */
export type TagRenameCommand = (id: string, name: string) => Promise<Tag>;

/** cmd:tag-delete — removes the tag AND cleans record references. */
export type TagDeleteCommand = (id: string) => Promise<void>;

/** ui:tag-picker props contract (editor form consumes). */
export interface TagPickerProps {
  readonly selectedIds: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
  /** Optional inline-create affordance. */
  readonly onCreate?: (name: string) => Promise<Tag | undefined>;
}

export type TagPickerComponent = React.ComponentType<TagPickerProps>;

/** cmd:record-remove-tag — edit-side bulk reference cleanup. */
export type RecordRemoveTagCommand = (tagId: string) => Promise<number>;

/** Search query object (all fields optional; empty = full set). */
export interface RecordQuery {
  /** Case-insensitive substring over title + originalTitle. */
  readonly text?: string;
  /** AND semantics: record must reference ALL ids. */
  readonly tagIds?: readonly string[];
  /** Inclusive [min, max]; 0 (unrated) matches when range includes 0. */
  readonly ratingRange?: { readonly min: number; readonly max: number };
  readonly mediaType?: "movie" | "episode";
  /** Inclusive watchedAt ISO-date string range. */
  readonly dateRange?: { readonly from: string; readonly to: string };
}

/** cmd:search — run the query engine, get matching records. */
export type SearchCommand = (query: RecordQuery) => Promise<readonly MovieRecord[]>;

/** tag:* event payload. */
export interface TagEventPayload {
  readonly id: string;
}

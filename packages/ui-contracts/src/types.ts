/**
 * Cross-plugin contract types. Pure TypeScript: react is referenced as
 * a type-only peer (component props), and NO platform API or runtime
 * module is imported (spec: ui-contracts "契约类型零平台依赖").
 */
import type { CapabilityRegistry, EventBus, ServiceRegistry } from "@auktake/core";
import type * as React from "react";

/** edit plugin: open the editor. No recordId = create mode. */
export type RecordEditCommand = (options?: { recordId?: string }) => void;

/** edit plugin: request deletion (second confirmation is edit-owned UX). */
export type RecordDeleteCommand = (recordId: string) => void;

/** display plugin: open the read-only detail view for a record. */
export type RecordDetailCommand = (recordId: string) => void;

/** Payload of every `record:*` event. */
export interface RecordEventPayload {
  readonly id: string;
}

/** timeline plugin's view component: data-carrying, prop-free. */
export type TimelineComponent = React.ComponentType;

/** Global overlay components rendered by the host shells' overlay host. */
export type OverlayComponent = React.ComponentType;

/**
 * Runtime deps explicitly injected into plugin factories by the shell's
 * composition root (design D1). The core's PluginContext keeps carrying
 * only lifecycle signals — the core is untouched.
 */
export interface PluginRuntimeDeps {
  readonly events: EventBus;
  readonly capabilities: CapabilityRegistry;
  readonly services: ServiceRegistry;
  /** True in development shells: enables console.warn degradation hints. */
  readonly dev?: boolean;
}

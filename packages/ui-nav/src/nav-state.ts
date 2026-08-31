import type { CapabilityRegistry } from "@auktake/core";
import { DEFAULT_TABS, type TabDefinition, type TabId } from "./tabs.js";

/** Computes the visible, ordered tab list from capability registration state. */
export function visibleTabs(
  registry: CapabilityRegistry,
  tabs: readonly TabDefinition[] = DEFAULT_TABS,
  opts: { dev?: boolean } = {},
): TabDefinition[] {
  const visible = tabs
    .filter((t) => registry.has(t.capabilityKey))
    .sort((a, b) => a.order - b.order);
  if (opts.dev) {
    for (const t of tabs) {
      if (!registry.has(t.capabilityKey)) {
        console.warn(`[ui-nav] tab "${t.id}" hidden: capability "${t.capabilityKey}" not registered`);
      }
    }
  }
  return visible;
}

/**
 * Navigation state: current tab id + switching. Pure state holder —
 * transitions/animations are deliberately out of scope (Phase 5).
 */
export class NavState {
  private current: TabId;
  private readonly listeners = new Set<(tab: TabId) => void>();

  constructor(initial: TabId = "records") {
    this.current = initial;
  }

  get currentTab(): TabId {
    return this.current;
  }

  switchTo(tab: TabId): void {
    if (tab === this.current) return;
    this.current = tab;
    for (const l of [...this.listeners]) {
      try {
        l(tab);
      } catch {
        // listener failures are isolated
      }
    }
  }

  subscribe(listener: (tab: TabId) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

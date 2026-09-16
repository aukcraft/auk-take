import { describe, expect, it, vi } from "vitest";
import { CapabilityRegistry } from "@auktake/core";
import { DEFAULT_TABS, NavState, adjacentTabId, shouldSwipeSwitch, visibleTabs } from "../src/index.js";

const registerAll = (reg: CapabilityRegistry, skip: string[] = []) => {
  for (const t of DEFAULT_TABS) {
    if (!skip.includes(t.id)) reg.register(t.capabilityKey, { stub: true });
  }
};

describe("visibleTabs", () => {
  it("shows all registered tabs ordered by order", () => {
    const reg = new CapabilityRegistry();
    registerAll(reg);
    const tabs = visibleTabs(reg);
    expect(tabs.map((t) => t.id)).toEqual(["records", "calendar", "read", "profile"]);
  });

  it("hides tabs whose capability is not registered (mood off -> read hidden)", () => {
    const reg = new CapabilityRegistry();
    registerAll(reg, ["read"]);
    const tabs = visibleTabs(reg);
    expect(tabs.map((t) => t.id)).toEqual(["records", "calendar", "profile"]);
  });

  it("warns in dev mode for unregistered capability keys", () => {
    const reg = new CapabilityRegistry();
    registerAll(reg, ["read"]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    visibleTabs(reg, DEFAULT_TABS, { dev: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ui:tab:read"));
    warn.mockRestore();
  });

  it("silent in non-dev mode", () => {
    const reg = new CapabilityRegistry();
    registerAll(reg, ["read"]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    visibleTabs(reg);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("NavState", () => {
  it("switches tab and notifies subscribers", () => {
    const nav = new NavState();
    const seen: string[] = [];
    nav.subscribe((t) => seen.push(t));
    nav.switchTo("calendar");
    nav.switchTo("profile");
    expect(nav.currentTab).toBe("profile");
    expect(seen).toEqual(["calendar", "profile"]);
  });

  it("same-tab switch is a no-op; listener errors isolated", () => {
    const nav = new NavState("records");
    const boom = vi.fn(() => {
      throw new Error("x");
    });
    const ok = vi.fn();
    nav.subscribe(boom);
    nav.subscribe(ok);
    expect(() => nav.switchTo("records")).not.toThrow();
    expect(ok).not.toHaveBeenCalled();
    nav.switchTo("calendar");
    expect(ok).toHaveBeenCalledWith("calendar");
  });
});

describe("phase-5 motion/gesture logic", () => {
  it("shouldSwipeSwitch requires horizontal dominance + threshold", () => {
    expect(shouldSwipeSwitch(80, 10)).toBe(true);
    expect(shouldSwipeSwitch(-80, 10)).toBe(true);
    expect(shouldSwipeSwitch(59, 0)).toBe(false); // under threshold
    expect(shouldSwipeSwitch(80, 50)).toBe(false); // not dominant (80 <= 2*50)
    expect(shouldSwipeSwitch(10, 80)).toBe(false); // vertical scroll
  });

  it("adjacentTabId walks the visible list and stops at edges", () => {
    const tabs = DEFAULT_TABS;
    expect(adjacentTabId(tabs, "records", 1)).toBe("calendar");
    expect(adjacentTabId(tabs, "calendar", -1)).toBe("records");
    expect(adjacentTabId(tabs, "records", -1)).toBeUndefined();
    expect(adjacentTabId(tabs, "profile", 1)).toBeUndefined();
  });
});

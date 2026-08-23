import { describe, expect, it, vi } from "vitest";
import { CapabilityRegistry } from "@auktake/core";
import { DEFAULT_TABS, NavState, visibleTabs } from "../src/index.js";

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

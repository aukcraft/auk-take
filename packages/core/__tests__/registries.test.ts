import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  PermissionError,
  PermissionManager,
  ServiceRegistry,
} from "../src/index.js";

describe("ServiceRegistry", () => {
  it("registers and retrieves; require throws descriptive error", () => {
    const reg = new ServiceRegistry();
    const impl = { loadAll: async () => [] };
    reg.register("storage", impl);
    expect(reg.get<{ loadAll: unknown }>("storage")).toBe(impl);
    expect(reg.get("missing")).toBeUndefined();
    expect(() => reg.require("missing")).toThrow(/Service not registered/);
  });
});

describe("CapabilityRegistry", () => {
  it("returns undefined for unregistered keys (no throw)", () => {
    const reg = new CapabilityRegistry();
    const Component = { render: 1 };
    reg.register("ui:rating-input", Component);
    expect(reg.get("ui:rating-input")).toBe(Component);
    expect(reg.get("ui:nope")).toBeUndefined();
    expect(reg.has("ui:rating-input")).toBe(true);
  });
});

describe("PermissionManager", () => {
  it("passes asserted declared permissions", () => {
    const pm = new PermissionManager();
    pm.declare("rating", ["storage:read"]);
    expect(() => pm.assertPermission("rating", "storage:read")).not.toThrow();
  });

  it("throws PermissionError for undeclared permissions", () => {
    const pm = new PermissionManager();
    pm.declare("rating", ["storage:read"]);
    expect(() => pm.assertPermission("rating", "network:fetch")).toThrow(PermissionError);
    expect(() => pm.assertPermission("unknown-plugin", "storage:read")).toThrow(
      PermissionError,
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { EditSessionController } from "../src/headless/edit-session";

describe("EditSessionController", () => {
  it("openNew: blank draft with injected default watch date", () => {
    const session = new EditSessionController();
    session.openNew("2026-05-20");
    const state = session.getState();
    expect(state.status).toBe("editing");
    expect(state.editingId).toBeNull();
    expect(state.draft.watchedAt).toBe("2026-05-20");
    expect(state.draft.title).toBe("");
  });

  it("setField updates draft and clears that field's error only", () => {
    const session = new EditSessionController();
    session.openNew("2026-05-20");
    session.setErrors({ title: "标题必填", watchedAt: "bad" });
    session.setField("title", "深海");
    const { errors, draft } = session.getState();
    expect(draft.title).toBe("深海");
    expect(errors.title).toBeUndefined();
    expect(errors.watchedAt).toBe("bad");
  });

  it("submit transitions are mutually exclusive and close resets", () => {
    const session = new EditSessionController();
    session.openNew("2026-05-20");
    session.beginSubmit();
    expect(session.getState().status).toBe("submitting");
    session.beginSubmit(); // ignored: not editing
    expect(session.getState().status).toBe("submitting");
    session.close();
    expect(session.getState().status).toBe("closed");
  });

  it("setField is ignored while closed", () => {
    const session = new EditSessionController();
    session.setField("title", "x");
    expect(session.getState().draft.title).toBe("");
  });

  it("delete prompt: request / cancel / take", () => {
    const session = new EditSessionController();
    session.requestDelete({ id: "r1", title: "深海" });
    expect(session.getState().deletePrompt).toEqual({ id: "r1", title: "深海" });
    session.cancelDelete();
    expect(session.getState().deletePrompt).toBeNull();

    session.requestDelete({ id: "r1", title: "深海" });
    expect(session.takeDeletePrompt()).toEqual({ id: "r1", title: "深海" });
    expect(session.getState().deletePrompt).toBeNull();
    expect(session.takeDeletePrompt()).toBeNull();
  });

  it("subscribers are notified and can unsubscribe", () => {
    const session = new EditSessionController();
    const listener = vi.fn();
    const off = session.subscribe(listener);
    session.openNew("2026-05-20");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    session.openNew("2026-05-21");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createHttpService } from "../src/headless/http-service";

function jsonResponse(status: number): Response {
  return new Response("{}", { status });
}

/** Controllable fake timers: sleeps resolve only when advanced. */
function makeClock() {
  const pending: { ms: number; resolve: () => void }[] = [];
  return {
    sleep: (ms: number) => new Promise<void>((r) => pending.push({ ms, resolve: r })),
    async advance(): Promise<void> {
      const queue = pending.splice(0);
      queue.forEach((p) => p.resolve());
      await Promise.resolve();
    },
    pendingCount: () => pending.length,
  };
}

describe("createHttpService", () => {
  it("passes url+init through on success", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200));
    const http = createHttpService({ fetchImpl, retries: 0 });
    const res = await http("https://x/a", { headers: { A: "b" } });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith("https://x/a", expect.objectContaining({ headers: { A: "b" } }));
  });

  it("4xx throws HttpError{status} immediately — no retry", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401));
    const http = createHttpService({ fetchImpl, retries: 2 });
    await expect(http("https://x/a")).rejects.toMatchObject({
      kind: "status",
      status: 401,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("5xx GET retries with exponential backoff and succeeds", async () => {
    const clock = makeClock();
    const fetchImpl = vi.fn(async () =>
      fetchImpl.mock.calls.length <= 2 ? jsonResponse(502) : jsonResponse(200),
    );
    const http = createHttpService({ fetchImpl, retries: 2, backoffBaseMs: 500, sleep: clock.sleep });
    const promise = http("https://x/a");
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(clock.pendingCount()).toBe(1));
    await clock.advance();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    await clock.advance();
    const res = await promise;
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("5xx retries exhausted -> HttpError{status}", async () => {
    const clock = makeClock();
    const fetchImpl = vi.fn(async () => jsonResponse(500));
    const http = createHttpService({ fetchImpl, retries: 1, sleep: clock.sleep });
    const promise = http("https://x/a");
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(clock.pendingCount()).toBe(1));
    await clock.advance(); // allow the single retry
    await expect(promise).rejects.toMatchObject({ kind: "status", status: 500 });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
  });

  it("network error on GET retries; POST does not", async () => {
    const clock = makeClock();
    let getCalls = 0;
    let postCalls = 0;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET").toUpperCase() === "GET") {
        getCalls += 1;
        if (getCalls <= 2) throw new TypeError("offline");
      } else {
        postCalls += 1;
        if (postCalls === 1) throw new TypeError("offline");
        // a (wrong) POST retry would land here and succeed
      }
      return jsonResponse(200);
    });
    const http = createHttpService({ fetchImpl, retries: 2, sleep: clock.sleep });
    const get = http("https://x/a");
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(clock.pendingCount()).toBe(1));
    await clock.advance();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    await clock.advance();
    const res = await get;
    expect(res.status).toBe(200);

    await expect(http("https://x/a", { method: "POST" })).rejects.toMatchObject({
      kind: "network",
    });
  });

  it("timeout aborts -> HttpError{timeout}", async () => {
    // never-resolving fetch; the abort factory flips signal and our
    // timeout mechanism races via the injected controller
    const listeners = new Set<() => void>();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as
            | { addEventListener?: (t: string, cb: () => void) => void }
            | undefined;
          signal?.addEventListener?.("abort", () => reject(new Error("aborted")));
        }),
    );
    const controller = {
      signal: {
        aborted: false,
        addEventListener(_t: string, cb: () => void) {
          listeners.add(cb);
        },
      },
      abort() {
        this.signal.aborted = true;
        for (const cb of [...listeners]) cb();
      },
    };
    // fire the service's timeout timer synchronously right after scheduling
    const g = globalThis as { setTimeout?: unknown };
    const originalSetTimeout = g.setTimeout;
    g.setTimeout = ((cb: () => void, _ms?: number) => {
      void Promise.resolve().then(() => cb());
      return 0;
    }) as unknown as typeof setTimeout;
    try {
      const http = createHttpService({
        fetchImpl,
        makeAbortController: () => controller,
        retries: 0,
      });
      await expect(http("https://x/slow")).rejects.toMatchObject({ kind: "timeout" });
    } finally {
      g.setTimeout = originalSetTimeout;
    }
  });

  it("dev log prints method/url/status without headers", async () => {
    const lines: string[] = [];
    const fetchImpl = vi.fn(async () => jsonResponse(200));
    const http = createHttpService({ fetchImpl, retries: 0, log: (l) => lines.push(l) });
    await http("https://x/a", { headers: { Authorization: "Bearer secret" } });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join("\n")).toContain("https://x/a");
    expect(lines.join("\n")).not.toContain("secret");
  });
});

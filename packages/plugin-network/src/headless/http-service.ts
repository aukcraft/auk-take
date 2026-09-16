/**
 * svc:http implementation (design D1): fetch-compatible wrapper with
 * timeout (AbortController), bounded GET retries (exponential backoff),
 * unified HttpError, and dev logging. Every platform touchpoint is
 * injectable — pure Node testable.
 */
import { HttpError, type HttpService } from "@auktake/ui-contracts";

export interface HttpServiceDeps {
  /** Raw fetch (platform native or a stub in tests). */
  readonly fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  /** Request timeout in ms (default 15s). */
  readonly timeoutMs?: number;
  /** Max retries for idempotent GET on network/5xx (default 2). */
  readonly retries?: number;
  /** Backoff base in ms (default 500; wait = base * 2^attempt). */
  readonly backoffBaseMs?: number;
  /** Injectable timer for tests; defaults to global setTimeout. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Injectable AbortController factory for tests. */
  readonly makeAbortController?: () => AbortControllerLike;
  /** Dev logging (method/url/status/elapsed only — never headers/body). */
  readonly log?: (line: string) => void;
}

export interface AbortControllerLike {
  readonly signal: { readonly aborted: boolean };
  abort(): void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const g = globalThis as { setTimeout?: (cb: () => void, ms: number) => unknown };
    if (g.setTimeout) {
      g.setTimeout(resolve, ms);
    } else {
      resolve();
    }
  });

const defaultMakeAbortController = (): AbortControllerLike => {
  const ctor = (globalThis as { AbortController?: new () => AbortControllerLike })
    .AbortController;
  if (!ctor) {
    // No AbortController in the environment: a no-op stand-in means the
    // timeout still REJECTS the promise (we race it), we just can't
    // cancel the underlying request.
    return { signal: { get aborted() { return false; } }, abort() {} };
  }
  return new ctor();
};

export function createHttpService(deps: HttpServiceDeps): HttpService {
  const fetchImpl = deps.fetchImpl;
  const timeoutMs = deps.timeoutMs ?? 15_000;
  const retries = deps.retries ?? 2;
  const backoffBaseMs = deps.backoffBaseMs ?? 500;
  const sleep = deps.sleep ?? defaultSleep;
  const makeController = deps.makeAbortController ?? defaultMakeAbortController;
  const log = deps.log;

  const isGet = (init?: RequestInit): boolean =>
    (init?.method ?? "GET").toUpperCase() === "GET";

  const attempt = async (
    url: string,
    init: RequestInit | undefined,
    signal: AbortControllerLike["signal"],
  ): Promise<Response> => {
    const merged: RequestInit = { ...init, signal: signal as RequestInit["signal"] };
    try {
      return await fetchImpl(url, merged);
    } catch (error) {
      if (signal.aborted) throw new HttpError("timeout", url);
      const detail = error instanceof Error ? error.message : String(error);
      throw new HttpError("network", url, undefined, detail);
    }
  };

  return async function httpService(url, init) {
    const startedAt = Date.now();
    const maxAttempts = 1 + (isGet(init) ? retries : 0);

    for (let attemptNo = 0; attemptNo < maxAttempts; attemptNo++) {
      const controller = makeController();
      const timeoutId = (globalThis as { setTimeout?: (cb: () => void, ms: number) => unknown })
        .setTimeout?.(() => controller.abort(), timeoutMs);
      try {
        const response = await attempt(url, init, controller.signal);
        if (response.status >= 500 && attemptNo < maxAttempts - 1) {
          log?.(`[http] GET ${url} -> ${response.status} (retry ${attemptNo + 1})`);
          await sleep(backoffBaseMs * 2 ** attemptNo);
          continue;
        }
        if (!response.ok) {
          log?.(`[http] GET ${url} -> ${response.status} (${Date.now() - startedAt}ms)`);
          throw new HttpError("status", url, response.status);
        }
        log?.(`[http] GET ${url} -> ${response.status} (${Date.now() - startedAt}ms)`);
        return response;
      } catch (error) {
        // 4xx/timeout: never retry
        if (error instanceof HttpError && (error.kind === "status" || error.kind === "timeout")) {
          throw error;
        }
        if (attemptNo < maxAttempts - 1) {
          log?.(`[http] GET ${url} -> network error (retry ${attemptNo + 1})`);
          await sleep(backoffBaseMs * 2 ** attemptNo);
          continue;
        }
        throw error instanceof HttpError ? error : new HttpError("network", url);
      } finally {
        if (timeoutId !== undefined) {
          (globalThis as { clearTimeout?: (h: unknown) => void }).clearTimeout?.(timeoutId);
        }
      }
    }
    /* unreachable — the loop always returns or throws */
    throw new HttpError("network", url);
  };
}

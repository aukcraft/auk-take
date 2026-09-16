/**
 * plugin-network factory (design D1): locked, NO permissions declared
 * (it issues no business requests itself — consumers hold network:fetch).
 * Registers the svc:http wrapper into the ServiceRegistry.
 */
import type { AukPlugin } from "@auktake/core";
import { HTTP_SERVICE, type HttpService, type PluginRuntimeDeps } from "@auktake/ui-contracts";
import { createHttpService } from "./headless/http-service";

export interface NetworkPluginOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly dev?: boolean;
}

export function createNetworkPlugin(
  _deps: PluginRuntimeDeps,
  options: NetworkPluginOptions = {},
): AukPlugin {
  return {
    id: "network",
    tier: "locked",
    permissions: [],

    async connect() {
      return { state: {} };
    },

    create() {
      const log = options.dev
        ? (line: string) => console.info(line)
        : undefined;
      const service: HttpService = createHttpService({
        fetchImpl: (url, init) => fetch(url, init),
        timeoutMs: options.timeoutMs,
        retries: options.retries,
        log,
      });
      _deps.services.register(HTTP_SERVICE, service);
      return {
        service,
        dispose() {
          _deps.services.unregister(HTTP_SERVICE);
        },
      };
    },
  };
}

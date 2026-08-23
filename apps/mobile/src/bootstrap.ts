import { ServiceRegistry } from "@auktake/core";
import { createRnStorage } from "@auktake/platform-rn";

/**
 * Mobile bootstrap: init core -> inject platform storage (op-sqlite).
 * Plugin startup arrives with the first real plugins in Phase 1; the
 * storage service is available from process start.
 */
export function bootstrapServices(): ServiceRegistry {
  const services = new ServiceRegistry();
  services.register("storage", createRnStorage("auktake.db"));
  return services;
}

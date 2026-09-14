import React from "react";
import type { CapabilityRegistry } from "@auktake/core";
import { OVERLAY_KEYS } from "@auktake/ui-contracts";

/**
 * Generic overlay host (design D8): renders every registered overlay
 * capability; zero awareness of any concrete plugin. Unregistered keys
 * render nothing.
 */
export function OverlayHost({ registry }: { registry: CapabilityRegistry }) {
  return (
    <>
      {OVERLAY_KEYS.map((key) => {
        const Overlay = registry.get<React.ComponentType>(key);
        return Overlay ? <Overlay key={key} /> : null;
      })}
    </>
  );
}

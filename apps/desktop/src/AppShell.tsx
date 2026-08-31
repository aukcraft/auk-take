import React from "react";
import type { CapabilityRegistry } from "@auktake/core";
import type { TabDefinition, TabId } from "@auktake/ui-nav";

interface AppShellProps {
  tabs: TabDefinition[];
  current: TabId;
  titles: Record<string, string>;
  registry: CapabilityRegistry;
  onSwitch: (tab: TabId) => void;
}

type ContentComponent = React.ComponentType;

/**
 * Desktop navigation skeleton: self-drawn LEFT SIDEBAR (D2/D3).
 * Pure RN syntax — rendered through react-native-web via the Vite alias.
 */
export function AppShell({ tabs, current, titles, registry, onSwitch }: AppShellProps) {
  const Content = registry.get<ContentComponent>(
    tabs.find((t) => t.id === current)?.capabilityKey ?? "",
  );

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <nav
        style={{
          width: 200,
          borderRight: "1px solid rgba(128,128,128,0.25)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onSwitch(t.id)}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 15,
              background: t.id === current ? "rgba(128,128,128,0.15)" : "transparent",
              fontWeight: t.id === current ? 600 : 400,
            }}
          >
            {titles[t.titleKey] ?? t.id}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: "auto" }}>
        {Content ? <Content /> : null}
      </main>
    </div>
  );
}

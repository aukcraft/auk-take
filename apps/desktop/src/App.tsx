import React, { useMemo, useState } from "react";
import { CapabilityRegistry } from "@auktake/core";
import { NavState, TAB_TITLES, visibleTabs, type TabDefinition } from "@auktake/ui-nav";
import { AppShell } from "./AppShell";

/**
 * Placeholder tab contents (Phase 1+ replaces via plugin capability
 * registration: "ui:tab:records" etc.).
 */
const PLACEHOLDERS: Record<string, string> = {
  "ui:tab:records": "记录",
  "ui:tab:calendar": "日历",
  "ui:tab:read": "读",
  "ui:tab:profile": "我的",
};

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 32, fontSize: 18, opacity: 0.6 }}>{title}（占位）</div>
  );
}

export function App() {
  const { registry, nav } = useMemo(() => {
    const registry = new CapabilityRegistry();
    for (const [key, label] of Object.entries(PLACEHOLDERS)) {
      registry.register(key, () => <Placeholder title={label} />);
      registry.register(key.replace("ui:tab:", "ui:icon:"), { placeholder: key });
    }
    return { registry, nav: new NavState() };
  }, []);

  const [tab, setTab] = useState(nav.currentTab);
  useMemo(() => nav.subscribe(setTab), [nav]);

  const tabs: TabDefinition[] = visibleTabs(registry, undefined, { dev: true });

  return <AppShell tabs={tabs} current={tab} titles={TAB_TITLES} registry={registry} onSwitch={(t) => nav.switchTo(t)} />;
}

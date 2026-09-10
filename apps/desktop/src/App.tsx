import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { colors } from "@auktake/ui-contracts";
import { NavState, TAB_CAPABILITY_KEYS, TAB_TITLES, visibleTabs, type TabDefinition } from "@auktake/ui-nav";
import { AppShell } from "./AppShell";
import { OverlayHost } from "./OverlayHost";
import { createRuntime } from "./bootstrap";

/** Profile tab stays a shell placeholder until its Phase lands. */
function ProfilePlaceholder() {
  return (
    <View style={{ padding: 32 }}>
      <Text style={{ fontSize: 18, opacity: 0.6, color: colors.text }}>我的（占位）</Text>
    </View>
  );
}

export function App() {
  const runtime = useMemo(() => createRuntime(import.meta.env.DEV), []);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void runtime.start().then(() => setReady(true));
  }, [runtime]);

  const nav = useMemo(() => new NavState(), []);
  const [tab, setTab] = useState(nav.currentTab);
  useMemo(() => nav.subscribe(setTab), [nav]);

  const registry = runtime.capabilities;
  useMemo(() => {
    registry.register(TAB_CAPABILITY_KEYS.profile, ProfilePlaceholder);
  }, [registry]);

  const tabs: TabDefinition[] = visibleTabs(registry, undefined, { dev: true });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppShell
        tabs={tabs}
        current={tab}
        titles={TAB_TITLES}
        registry={registry}
        onSwitch={(t) => nav.switchTo(t)}
      />
      {ready ? <OverlayHost registry={registry} /> : null}
    </View>
  );
}

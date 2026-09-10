import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NavState, TAB_CAPABILITY_KEYS, TAB_TITLES, visibleTabs, type TabDefinition, type TabId } from "@auktake/ui-nav";
import { createRuntime } from "./src/bootstrap";
import { OverlayHost } from "./src/OverlayHost";

/** Profile tab stays a shell placeholder until its Phase lands. */
function ProfilePlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>我的（占位）</Text>
    </View>
  );
}

type ContentComponent = React.ComponentType;

/**
 * Mobile shell: composition root -> bottom TabBar skeleton. Tab content
 * comes from plugin capabilities ("ui:tab:records" etc.); the shell
 * renders only the profile placeholder. records/calendar/read content
 * (and the read tab itself) appear iff their plugins register them.
 */
export default function App(): React.JSX.Element {
  const runtime = useMemo(() => createRuntime(), []);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void runtime.start().then(() => setReady(true));
  }, [runtime]);

  const nav = useMemo(() => new NavState(), []);
  const [tab, setTab] = useState<TabId>(nav.currentTab);
  useMemo(() => nav.subscribe(setTab), [nav]);

  const registry = runtime.capabilities;
  useMemo(() => {
    registry.register(TAB_CAPABILITY_KEYS.profile, ProfilePlaceholder);
  }, [registry]);

  const tabs: TabDefinition[] = visibleTabs(registry, undefined, { dev: true });
  const Content = registry.get<ContentComponent>(
    tabs.find((t) => t.id === tab)?.capabilityKey ?? "",
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        {ready && Content ? <Content /> : null}
      </View>
      <View style={styles.tabbar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.tabItem}
            onPress={() => nav.switchTo(t.id)}
            accessibilityRole="button"
            accessibilityLabel={TAB_TITLES[t.titleKey] ?? t.id}
          >
            <Text style={[styles.tabText, t.id === tab && styles.tabTextActive]}>
              {TAB_TITLES[t.titleKey] ?? t.id}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {ready ? <OverlayHost registry={registry} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  placeholder: { padding: 32 },
  placeholderText: { fontSize: 18, opacity: 0.6 },
  tabbar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.3)",
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 14, opacity: 0.6 },
  tabTextActive: { opacity: 1, fontWeight: "600" },
});

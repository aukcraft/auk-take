import React, { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CapabilityRegistry } from "@auktake/core";
import { NavState, TAB_TITLES, visibleTabs, type TabDefinition, type TabId } from "@auktake/ui-nav";
import { bootstrapServices } from "./src/bootstrap";

/**
 * Placeholder tab contents; Phase 1+ plugins register real components
 * under "ui:tab:records" etc. via the CapabilityRegistry.
 */
const PLACEHOLDERS: Record<string, string> = {
  "ui:tab:records": "记录",
  "ui:tab:calendar": "日历",
  "ui:tab:read": "读",
  "ui:tab:profile": "我的",
};

function Placeholder({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{title}（占位）</Text>
    </View>
  );
}

type ContentComponent = React.ComponentType;

/**
 * Mobile shell: bootstrap core -> render bottom TabBar skeleton (D2).
 * Self-drawn, no react-navigation.
 */
export default function App(): React.JSX.Element {
  const { registry, nav, services } = useMemo(() => {
    const services = bootstrapServices();
    const registry = new CapabilityRegistry();
    for (const [key, label] of Object.entries(PLACEHOLDERS)) {
      registry.register(key, () => <Placeholder title={label} />);
      registry.register(key.replace("ui:tab:", "ui:icon:"), { placeholder: key });
    }
    return { registry, nav: new NavState(), services };
  }, []);

  const [tab, setTab] = useState<TabId>(nav.currentTab);
  useMemo(() => nav.subscribe(setTab), [nav]);

  const tabs: TabDefinition[] = visibleTabs(registry, undefined, { dev: true });
  const Content = registry.get<ContentComponent>(
    tabs.find((t) => t.id === tab)?.capabilityKey ?? "",
  );

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView style={styles.content}>
        {Content ? <Content /> : null}
      </ScrollView>
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

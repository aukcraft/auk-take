import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { CapabilityRegistry } from "@auktake/core";
import { MOTION, colors } from "@auktake/ui-contracts";
import type { TabDefinition, TabId } from "@auktake/ui-nav";

/** True when the OS asks for reduced motion (design D5: instant settle). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/**
 * Tab entrance transition: fade + 8px rise on every remount (callers
 * key this view by tab id). MOTION tokens are the single source;
 * reduced motion settles instantly.
 */
function EntranceView({
  reduced,
  style,
  children,
}: {
  reduced: boolean;
  style?: object;
  children?: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: MOTION.duration.base,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [anim, reduced]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface AppShellProps {
  tabs: TabDefinition[];
  current: TabId;
  titles: Record<string, string>;
  registry: CapabilityRegistry;
  onSwitch: (tabId: TabId) => void;
}

type ContentComponent = React.ComponentType;

/** Below this width the desktop shell adopts the mobile nav shape. */
const BOTTOM_NAV_BREAKPOINT = 720;

/**
 * Responsive navigation skeleton: wide windows get the self-drawn LEFT
 * SIDEBAR (D2/D3); narrow windows match the mobile shell's BOTTOM TAB
 * BAR — same tab data, same content keys. Pure RN syntax, rendered
 * through react-native-web via the Vite alias.
 */
export function AppShell({ tabs, current, titles, registry, onSwitch }: AppShellProps) {
  const { width } = useWindowDimensions();
  const wide = width >= BOTTOM_NAV_BREAKPOINT;
  const reduced = useReducedMotion();
  const Content = registry.get<ContentComponent>(
    tabs.find((t) => t.id === current)?.capabilityKey ?? "",
  );

  return (
    <View style={[styles.root, wide ? styles.rootWide : styles.rootNarrow]}>
      {wide ? (
        <View style={styles.sidebar}>
          {tabs.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onSwitch(t.id)}
              style={({ pressed }) => [
                styles.sideItem,
                t.id === current && styles.sideItemActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.sideText, t.id === current && styles.sideTextActive]}>
                {titles[t.titleKey] ?? t.id}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.main}>
        <EntranceView key={current} reduced={reduced} style={styles.mainContent}>
          {Content ? <Content /> : null}
        </EntranceView>
      </View>
      {!wide ? (
        <View style={styles.tabbar}>
          {tabs.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onSwitch(t.id)}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityLabel={titles[t.titleKey] ?? t.id}
            >
              <Text style={[styles.tabText, t.id === current && styles.tabTextActive]}>
                {titles[t.titleKey] ?? t.id}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, height: "100vh", backgroundColor: colors.bg },
  rootWide: { flexDirection: "row" },
  rootNarrow: { flexDirection: "column" },
  sidebar: {
    width: 200,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(128,128,128,0.25)",
    padding: 16,
    gap: 4,
  },
  sideItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  sideItemActive: { backgroundColor: "rgba(128,128,128,0.15)" },
  sideText: { fontSize: 15, color: "#EDEDF2" },
  sideTextActive: { fontWeight: "600" },
  main: { flex: 1, overflow: "hidden", backgroundColor: colors.bg },
  mainContent: { flex: 1 },
  tabbar: {
    width: "100%",
    backgroundColor: colors.surface,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.3)",
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 14, opacity: 0.6, color: "#EDEDF2" },
  tabTextActive: { opacity: 1, fontWeight: "600" },
  pressed: { opacity: 0.7 },
});

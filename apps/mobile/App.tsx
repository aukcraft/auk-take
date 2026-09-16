import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MOTION, colors } from "@auktake/ui-contracts";
import {
  NavState,
  TAB_CAPABILITY_KEYS,
  TAB_TITLES,
  adjacentTabId,
  shouldSwipeSwitch,
  visibleTabs,
  type TabDefinition,
  type TabId,
} from "@auktake/ui-nav";
import { createRuntime } from "./src/bootstrap";
import { OverlayHost } from "./src/OverlayHost";

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

  // Phase 5: entrance transition (fade + rise, MOTION tokens; keyed
  // remount per tab) + horizontal swipe to switch adjacent tabs
  // (PanResponder; vertical scroll never stolen — |dx| > 2|dy|).
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(1)).current;
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
  }, [anim, reduced, tab]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > 2 * Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          if (!shouldSwipeSwitch(g.dx, g.dy)) return;
          const next = adjacentTabId(tabs, tab, g.dx < 0 ? 1 : -1);
          if (next) nav.switchTo(next);
        },
      }),
    [nav, tabs, tab],
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.contentInner,
            {
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
              ],
            },
          ]}
        >
          {ready && Content ? <Content /> : null}
        </Animated.View>
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
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  contentInner: { flex: 1 },
  placeholder: { padding: 32 },
  placeholderText: { fontSize: 18, opacity: 0.6, color: colors.text },
  tabbar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.3)",
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 14, opacity: 0.6, color: colors.text },
  tabTextActive: { opacity: 1, fontWeight: "600" },
});

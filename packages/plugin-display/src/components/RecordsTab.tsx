/**
 * Records tab content (headed): poster wall + timeline segmented
 * switch + empty state CTA. Local view preference is memory-only
 * (spec: 视图切换消费时间线能力).
 */
import React, { useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CapabilityRegistry, MovieRecord } from "@auktake/core";
import type { Projection } from "@auktake/ui-contracts";
import {
  CAPABILITY_KEYS,
  colors,
  fontWeight,
  radius,
  spacing,
  type RecordEditCommand,
  type TimelineComponent,
} from "@auktake/ui-contracts";
import { PosterWall } from "./PosterWall";

type ViewId = "poster" | "timeline";

export function createRecordsTab(
  projection: Projection<MovieRecord>,
  capabilities: CapabilityRegistry,
  dev: boolean,
): React.ComponentType {
  return function RecordsTab() {
    const records = useSyncExternalStore(
      projection.subscribe.bind(projection),
      projection.getState.bind(projection),
    );
    const [view, setView] = useState<ViewId>("poster");

    const timeline = capabilities.get<TimelineComponent>(CAPABILITY_KEYS.viewTimeline);
    if (timeline === undefined && dev) {
      console.warn(
        `[display] view switch hidden: capability "${CAPABILITY_KEYS.viewTimeline}" not registered`,
      );
    }

    const openEditor = capabilities.get<RecordEditCommand>(CAPABILITY_KEYS.recordEdit);
    const openTmdbConfig = capabilities.get<() => void>(CAPABILITY_KEYS.tmdbConfigure);

    return (
      <View style={styles.root}>
        {records.length === 0 ? (
          <EmptyState openEditor={openEditor} />
        ) : (
          <>
            <View style={styles.header}>
              {timeline ? (
                <View style={styles.segment}>
                  {(
                    [
                      ["poster", "海报墙"],
                      ["timeline", "时间线"],
                    ] as const
                  ).map(([id, label]) => (
                    <Pressable
                      key={id}
                      onPress={() => setView(id)}
                      style={[styles.segItem, view === id && styles.segActive]}
                    >
                      <Text style={[styles.segText, view === id && styles.segTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.headerSpacer} />
              )}
              <View style={styles.headerActions}>
                {openTmdbConfig ? (
                  <Pressable
                    style={styles.gearButton}
                    onPress={() => openTmdbConfig()}
                    accessibilityLabel="TMDB 设置"
                  >
                    <Text style={styles.gearText}>TMDB</Text>
                  </Pressable>
                ) : null}
                {openEditor ? (
                  <Pressable
                    style={styles.addButton}
                    onPress={() => openEditor()}
                    accessibilityLabel="记录观影"
                  >
                    <Text style={styles.addButtonText}>＋ 记录</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {view === "poster" ? (
              <PosterWall records={records} capabilities={capabilities} />
            ) : timeline ? (
              <TimelineSlot Component={timeline} />
            ) : null}
          </>
        )}
      </View>
    );
  };
}

function TimelineSlot({ Component }: { Component: TimelineComponent }) {
  return <Component />;
}

function EmptyState({ openEditor }: { openEditor: RecordEditCommand | undefined }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>还没有观影记录</Text>
      <Text style={styles.emptyBody}>记录你看过的每一部电影和剧集，构建你的观影史。</Text>
      {openEditor ? (
        <Pressable style={styles.cta} onPress={() => openEditor()}>
          <Text style={styles.ctaText}>记录第一部影片</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  headerSpacer: { flex: 1 },
  segment: {
    flexDirection: "row",
    gap: spacing.xs,
    flex: 1,
    justifyContent: "center",
  },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  gearButton: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gearText: { color: colors.textMuted, fontSize: 13 },
  addButton: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  addButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: fontWeight.semibold as never },
  segItem: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  segActive: { backgroundColor: colors.accent },
  segText: { color: colors.textMuted, fontSize: 13 },
  segTextActive: { color: "#FFFFFF", fontWeight: fontWeight.semibold as never },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.md },
  emptyTitle: { fontSize: 20, fontWeight: fontWeight.bold as never, color: colors.text },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  cta: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  ctaText: { color: "#FFFFFF", fontWeight: fontWeight.semibold as never },
});

/**
 * Yearly recap view (headed): overview numbers, monthly View-proportion
 * bars (no chart library — design D5), genre/tag distributions, top
 * day. Drill-down via cmd:search (degrades to non-tappable).
 */
import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, CloudDownload, Settings } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CapabilityRegistry, EventBus, MovieRecord } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  JELLYFIN_EVENTS,
  colors,
  type JellyfinSyncCommand,
  type JellyfinSyncProgress,
  type JellyfinSyncResult,
  fontWeight,
  radius,
  spacing,
  type Projection,
  type SearchCommand,
  type TagListCommand,
} from "@auktake/ui-contracts";
import { aggregateYear } from "../headless/aggregate";

const MONTH_LABELS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

function StatNumber({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function createStatsView(
  projection: Projection<MovieRecord>,
  capabilities: CapabilityRegistry,
  dev: boolean,
  events?: EventBus,
): React.ComponentType {
  return function StatsView() {
    const records = useSyncExternalStore(
      projection.subscribe.bind(projection),
      projection.getState.bind(projection),
    );
    const currentYear = useMemo(() => new Date().getFullYear(), []);
    const [year, setYear] = useState(currentYear);

    const tagList = capabilities.get<TagListCommand>(CAPABILITY_KEYS.tagList);
    const search = capabilities.get<SearchCommand>(CAPABILITY_KEYS.search);
    const jellyfinSync = capabilities.get<JellyfinSyncCommand>(CAPABILITY_KEYS.jellyfinSync);
    const jellyfinConfigure = capabilities.get<() => void>(CAPABILITY_KEYS.jellyfinConfigure);
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    // Live batch progress while a sync runs (jellyfin plugin emits after
    // each committed batch; large libraries import gradually).
    useEffect(() => {
      if (!events || !syncing) return;
      return events.on<JellyfinSyncProgress>(JELLYFIN_EVENTS.syncProgress, (p) => {
        setSyncMessage(`同步中… 已拉取 ${p.fetched} 条，导入 ${p.imported} 条`);
      });
    }, [events, syncing]);

    const runSync = async (): Promise<void> => {
      if (!jellyfinSync) return;
      setSyncing(true);
      setSyncMessage(null);
      const result: JellyfinSyncResult = await jellyfinSync();
      setSyncing(false);
      setSyncMessage(
        result.status === "imported"
          ? `已从 Jellyfin 导入 ${result.count} 条记录`
          : result.status === "noop"
            ? "没有新的观看记录"
            : `同步失败：${result.message}`,
      );
    };
    if (search === undefined && dev) {
      console.warn(`[stats] drill-down disabled: "${CAPABILITY_KEYS.search}" not registered`);
    }

    const years = useMemo(() => {
      let min = currentYear;
      for (const r of records) {
        const y = Number(r.user.watchedAt.slice(0, 4));
        if (y > 0 && y < min) min = y;
      }
      const list: number[] = [];
      for (let y = min; y <= currentYear; y++) list.push(y);
      return list;
    }, [records, currentYear]);

    const stats = useMemo(
      () => aggregateYear(records, year, tagList?.() ?? []),
      [records, year, tagList],
    );
    const maxMonthly = Math.max(...stats.monthlyCounts, 1);

    const drill = async (
      query: Parameters<SearchCommand>[0],
    ): Promise<readonly MovieRecord[] | null> => (search ? search(query) : null);

    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.yearBar}>
          <Pressable
            disabled={!years.includes(year - 1)}
            onPress={() => setYear(year - 1)}
            style={styles.yearArrow}
          >
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.yearText}>{year} 年度回顾</Text>
          <Pressable
            disabled={!years.includes(year + 1)}
            onPress={() => setYear(year + 1)}
            style={styles.yearArrow}
          >
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatNumber label="观看总数" value={String(stats.totalCount)} />
          <StatNumber label="观影天数" value={String(stats.watchedDays)} />
          <StatNumber label="平均分" value={stats.avgRating === null ? "—" : String(stats.avgRating)} />
        </View>
        <View style={styles.statsRow}>
          <StatNumber label="电影" value={String(stats.movieCount)} />
          <StatNumber label="剧集" value={String(stats.episodeCount)} />
          <StatNumber
            label="最长观影日"
            value={stats.topDay ? `${stats.topDay.count} 部` : "—"}
          />
        </View>
        {stats.topDay ? (
          <Text style={styles.topDayHint}>最密集的一天：{stats.topDay.date}（{stats.topDay.count} 部）</Text>
        ) : null}

        <Text style={styles.section}>月度分布</Text>
        <View style={styles.bars}>
          {stats.monthlyCounts.map((count, i) => (
            <View key={i} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  { height: Math.max(4, Math.round((count / maxMonthly) * 96)) },
                  count === 0 && styles.barEmpty,
                ]}
              />
              <Text style={styles.barLabel}>{MONTH_LABELS[i]}</Text>
            </View>
          ))}
        </View>

        {stats.genreCounts.length > 0 ? (
          <>
            <Text style={styles.section}>类型分布</Text>
            <View style={styles.chips}>
              {stats.genreCounts.slice(0, 10).map((g) => (
                <View key={g.name} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {g.name} × {g.count}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {stats.tagCounts.length > 0 ? (
          <>
            <Text style={styles.section}>标签 TOP</Text>
            <View style={styles.chips}>
              {stats.tagCounts.slice(0, 10).map((t) => (
                <Pressable
                  key={t.id}
                  style={[styles.chip, search ? styles.chipTappable : null]}
                  disabled={!search}
                  onPress={() => {
                    void drill({
                      tagIds: [t.id],
                      dateRange: { from: `${year}-01-01`, to: `${year}-12-31` },
                    });
                  }}
                >
                  <Text style={styles.chipText}>
                    {t.name} × {t.count}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.drillHint}>
              {search ? "点击标签查看该年记录" : "搜索插件未加载，下钻不可用"}
            </Text>
          </>
        ) : null}

        <View style={styles.jfRow}>
          {jellyfinSync ? (
            <Pressable
              style={[styles.jfButton, syncing && { opacity: 0.6 }]}
              disabled={syncing}
              onPress={() => void runSync()}
              accessibilityLabel="从 Jellyfin 导入"
            >
              <CloudDownload size={15} color="#FFFFFF" />
              <Text style={styles.jfButtonText}>
                {syncing ? "同步中…" : "从 Jellyfin 导入"}
              </Text>
            </Pressable>
          ) : null}
          {jellyfinConfigure ? (
            <Pressable
              style={styles.jfGear}
              onPress={() => jellyfinConfigure()}
              accessibilityLabel="Jellyfin 设置"
            >
              <Settings size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {syncMessage ? <Text style={styles.jfMessage}>{syncMessage}</Text> : null}
      </ScrollView>
    );
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  yearBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  yearArrow: { padding: spacing.xs },
  yearText: { fontSize: 20, fontWeight: fontWeight.bold as never, color: colors.text },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  statValue: { fontSize: 22, fontWeight: fontWeight.bold as never, color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted },
  topDayHint: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  section: { fontSize: 16, fontWeight: fontWeight.semibold as never, color: colors.text, marginTop: spacing.md },
  bars: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  barCol: { alignItems: "center", gap: spacing.xs, flex: 1 },
  bar: { width: 12, borderRadius: 3, backgroundColor: colors.accent },
  barEmpty: { backgroundColor: colors.surfaceElevated },
  barLabel: { fontSize: 10, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTappable: { borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.text },
  drillHint: { fontSize: 12, color: colors.textMuted },
  jfRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  jfButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  jfButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: fontWeight.medium as never },
  jfGear: {
    padding: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  jfMessage: { fontSize: 12, color: colors.textMuted },
});

/**
 * Calendar tab content (headed): yearly heatmap. Mobile scrolls the
 * grid horizontally, desktop lays the whole year flat — same-file
 * branch consuming the SAME grid computation (spec: 布局平台适配).
 * Tapping a day opens the day panel; panel entries forward
 * cmd:record-detail / cmd:record-edit with graceful degradation.
 */
import React, { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CapabilityRegistry, MovieRecord } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  HEATMAP_LEVEL_COLORS,
  colors,
  fontWeight,
  radius,
  spacing,
  type Projection,
  type RecordDetailCommand,
  type RecordEditCommand,
} from "@auktake/ui-contracts";
import { episodeBadge } from "./episode";
import {
  bucketByDay,
  buildYearGrid,
  recordsOnDay,
  yearRange,
} from "../headless/heatmap";

const CELL = 12;
const CELL_GAP = 2;

function ratingText(record: MovieRecord): string {
  return record.user.rating === 0 ? "未评分" : `${record.user.rating} 分`;
}

function HeatmapGrid({
  grid,
  onDayPress,
}: {
  grid: ReturnType<typeof buildYearGrid>;
  onDayPress: (day: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {grid.weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((cell, d) =>
            cell.date ? (
              <Pressable
                key={cell.date}
                onPress={() => onDayPress(cell.date)}
                style={[
                  styles.cell,
                  { backgroundColor: HEATMAP_LEVEL_COLORS[cell.level] },
                ]}
                accessibilityLabel={`${cell.date} ${cell.count} 条`}
              />
            ) : (
              <View key={`${w}-${d}`} style={styles.cellPad} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function DayPanel({
  day,
  records,
  capabilities,
  onClose,
  dev,
}: {
  day: string;
  records: readonly MovieRecord[];
  capabilities: CapabilityRegistry;
  onClose: () => void;
  dev: boolean;
}) {
  const openDetail = capabilities.get<RecordDetailCommand>(CAPABILITY_KEYS.recordDetail);
  const openEditor = capabilities.get<RecordEditCommand>(CAPABILITY_KEYS.recordEdit);
  if (openDetail === undefined && dev) {
    console.warn(
      `[record] day entries not tappable: capability "${CAPABILITY_KEYS.recordDetail}" not registered`,
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.panelOverlay} onPress={onClose}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{day} 的观影</Text>
          {records.length === 0 ? (
            <Text style={styles.panelEmpty}>当日暂无记录</Text>
          ) : (
            records.map((record) => {
              const badge = episodeBadge(record);
              const tappable = openDetail !== undefined;
              return (
                <Pressable
                  key={record.id}
                  disabled={!tappable}
                  onPress={tappable ? () => openDetail?.(record.id) : undefined}
                  style={({ pressed }) => [styles.panelRow, pressed && tappable && { opacity: 0.7 }]}
                >
                  <Text style={styles.panelRowTitle} numberOfLines={1}>
                    {record.tmdb.title}
                  </Text>
                  <Text style={styles.panelRowMeta}>
                    {badge ? `${badge} · ` : ""}
                    {ratingText(record)}
                  </Text>
                </Pressable>
              );
            })
          )}
          {openEditor ? (
            <Pressable
              style={styles.panelCta}
              onPress={() => {
                onClose();
                openEditor();
              }}
            >
              <Text style={styles.panelCtaText}>补记当天</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

export function createCalendarView(
  projection: Projection<MovieRecord>,
  capabilities: CapabilityRegistry,
  dev: boolean,
): React.ComponentType {
  return function CalendarView() {
    const records = useSyncExternalStore(
      projection.subscribe.bind(projection),
      projection.getState.bind(projection),
    );
    const currentYear = useMemo(() => new Date().getFullYear(), []);
    const years = useMemo(() => yearRange(records, currentYear), [records, currentYear]);
    const [year, setYear] = useState<number>(years.at(-1) ?? currentYear);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const grid = useMemo(() => buildYearGrid(year, bucketByDay(records, year)), [records, year]);
    const dayRecords = useMemo(
      () => (selectedDay === null ? [] : recordsOnDay(records, selectedDay)),
      [records, selectedDay],
    );

    return (
      <View style={styles.root}>
        <View style={styles.yearBar}>
          <Pressable
            disabled={!years.includes(year - 1)}
            onPress={() => setYear(year - 1)}
            style={styles.yearArrow}
          >
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.yearText}>{year}</Text>
          <Pressable
            disabled={!years.includes(year + 1)}
            onPress={() => setYear(year + 1)}
            style={styles.yearArrow}
          >
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </View>
        {Platform.OS === "web" ? (
          <ScrollView horizontal={false} contentContainerStyle={styles.flat}>
            <HeatmapGrid grid={grid} onDayPress={setSelectedDay} />
          </ScrollView>
        ) : (
          <ScrollView horizontal contentContainerStyle={styles.hscroll}>
            <HeatmapGrid grid={grid} onDayPress={setSelectedDay} />
          </ScrollView>
        )}
        <View style={styles.legend}>
          {HEATMAP_LEVEL_COLORS.map((c, i) => (
            <View key={i} style={[styles.legendCell, { backgroundColor: c }]} />
          ))}
          <Text style={styles.legendText}>少 → 多</Text>
        </View>
        {selectedDay !== null ? (
          <DayPanel
            day={selectedDay}
            records={dayRecords}
            capabilities={capabilities}
            dev={dev}
            onClose={() => setSelectedDay(null)}
          />
        ) : null}
      </View>
    );
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.md, backgroundColor: colors.bg },
  yearBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  yearArrow: { padding: spacing.xs },
  yearText: { fontSize: 18, fontWeight: fontWeight.bold as never, color: colors.text },
  hscroll: { paddingHorizontal: spacing.md },
  flat: { alignItems: "center", padding: spacing.md },
  grid: { flexDirection: "row", gap: CELL_GAP },
  week: { flexDirection: "column", gap: CELL_GAP },
  cell: { width: CELL, height: CELL, borderRadius: 2 },
  cellPad: { width: CELL, height: CELL },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    justifyContent: "center",
    paddingBottom: spacing.md,
  },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, color: colors.textMuted, marginLeft: spacing.xs },
  panelOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  panel: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    maxHeight: "70%",
  },
  panelTitle: { fontSize: 18, fontWeight: fontWeight.bold as never, color: colors.text },
  panelEmpty: { color: colors.textMuted },
  panelRow: { gap: 2, paddingVertical: spacing.xs },
  panelRowTitle: { fontSize: 16, color: colors.text },
  panelRowMeta: { fontSize: 13, color: colors.textMuted },
  panelCta: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
  },
  panelCtaText: { color: "#FFFFFF", fontWeight: fontWeight.semibold as never },
});

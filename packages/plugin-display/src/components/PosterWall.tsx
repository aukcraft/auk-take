/**
 * Poster wall grid (headed, single-source RN syntax). Rows are chunked
 * MANUALLY (deterministic 2:3 portrait cards on both renderers) instead
 * of FlatList numColumns, whose web behavior around row stretching is
 * unreliable (user-reported: cards filling the screen). FlatList stays
 * as the vertical windowed scroller; columns adapt by platform shape:
 * mobile fixed 3, desktop grows with window width breakpoints (D5).
 */
import React, { useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { CapabilityRegistry, MovieRecord } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  POSTER_PALETTE,
  colorHash,
  colors,
  fontWeight,
  radius,
  spacing,
  type RecordDetailCommand,
} from "@auktake/ui-contracts";
import {
  episodeBadge,
  ratingLabel,
  releaseYear,
  sortByWatchedAtDesc,
} from "../headless/selectors";

function desktopColumns(width: number): number {
  if (width >= 1200) return 6;
  if (width >= 900) return 5;
  if (width >= 640) return 4;
  return 3;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size) as T[]);
  }
  return rows;
}

function ColorCard({ record }: { record: MovieRecord }) {
  const slot = POSTER_PALETTE[colorHash(record.id)] ?? POSTER_PALETTE[0]!;
  return (
    <View style={[styles.card, { backgroundColor: slot.bg }]}>
      <Text style={[styles.cardTitle, { color: slot.fg }]} numberOfLines={3}>
        {record.tmdb.title}
      </Text>
      <Text style={[styles.cardMeta, { color: slot.fg }]}>
        {releaseYear(record) || "—"}
      </Text>
    </View>
  );
}

function Card({
  record,
  openDetail,
}: {
  record: MovieRecord;
  openDetail: RecordDetailCommand | undefined;
}) {
  const pressable = openDetail !== undefined;
  const Wrapper = pressable ? Pressable : View;
  return (
    <Wrapper
      style={styles.cell}
      onPress={pressable ? () => openDetail?.(record.id) : undefined}
      disabled={!pressable}
    >
      {/* resolvePosterSource(record): Phase 2 renders image branches
          (mediaCache.poster → tmdb.posterPath) here; Phase 1 data
          always falls through to the deterministic color card. */}
      <ColorCard record={record} />
      <Text style={styles.badgeLine} numberOfLines={1}>
        {episodeBadge(record) || (record.tmdb.mediaType === "movie" ? "电影" : "剧集")}
        {" · "}
        {ratingLabel(record)}
      </Text>
    </Wrapper>
  );
}

export function PosterWall({
  records,
  capabilities,
}: {
  records: readonly MovieRecord[];
  capabilities: CapabilityRegistry;
}) {
  const { width } = useWindowDimensions();
  const columns = useMemo(
    () => (Platform.OS === "web" ? desktopColumns(width) : 3),
    [width],
  );
  const openDetail = capabilities.get<RecordDetailCommand>(CAPABILITY_KEYS.recordDetail);
  const sorted = useMemo(() => sortByWatchedAtDesc(records), [records]);
  const rows = useMemo(() => chunk(sorted, columns), [sorted, columns]);

  return (
    <FlatList
      style={styles.list}
      data={rows}
      key={`grid-${columns}`}
      keyExtractor={(_row, index) => String(index)}
      contentContainerStyle={styles.grid}
      renderItem={({ item: row }) => (
        <View style={styles.row}>
          {row.map((record) => (
            <Card key={record.id} record={record} openDetail={openDetail} />
          ))}
          {/* pad the trailing incomplete row so cells keep equal width */}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`pad-${i}`} style={styles.cellPad} />
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  grid: { padding: spacing.sm, gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  cell: { flex: 1, gap: spacing.xs },
  cellPad: { flex: 1 },
  card: {
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  cardTitle: { fontSize: 15, fontWeight: fontWeight.semibold as never },
  cardMeta: { fontSize: 12, opacity: 0.85 },
  badgeLine: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
});

/**
 * Poster wall grid (headed, single-source RN syntax). Columns adapt by
 * platform shape: mobile fixed 3, desktop grows with window width
 * breakpoints (same-file branch, design D5).
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
  if (width >= 960) return 6;
  if (width >= 640) return 4;
  return 3;
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

  return (
    <FlatList
      data={sorted}
      key={columns}
      numColumns={columns}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={columns > 1 ? styles.row : undefined}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => {
        const pressable = openDetail !== undefined;
        const Wrapper = pressable ? Pressable : View;
        return (
          <Wrapper
            style={styles.cell}
            onPress={pressable ? () => openDetail?.(item.id) : undefined}
            disabled={!pressable}
          >
            {/* resolvePosterSource(item): Phase 2 renders image branches
                (mediaCache.poster → tmdb.posterPath) here; Phase 1 data
                always falls through to the deterministic color card. */}
            <ColorCard record={item} />
            <Text style={styles.badgeLine} numberOfLines={1}>
              {episodeBadge(item) || (item.tmdb.mediaType === "movie" ? "电影" : "剧集")}
              {" · "}
              {ratingLabel(item)}
            </Text>
          </Wrapper>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  grid: { padding: spacing.sm, gap: spacing.sm },
  row: { gap: spacing.sm },
  cell: { flex: 1, gap: spacing.xs },
  card: {
    aspectRatio: "2/3",
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  cardTitle: { fontSize: 15, fontWeight: fontWeight.semibold as never },
  cardMeta: { fontSize: 12, opacity: 0.85 },
  badgeLine: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
});

/**
 * Timeline view (headed): color-card thumbnail, title, SxxExx badge,
 * watch date, rating summary. Item taps FORWARD cmd:record-detail;
 * missing command degrades to non-tappable (no throw).
 */
import React, { useMemo, useSyncExternalStore } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { CapabilityRegistry, MovieRecord } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  IMAGE_CACHE_SERVICE,
  POSTER_PALETTE,
  colorHash,
  colors,
  fontWeight,
  radius,
  spacing,
  tmdbImageUrl,
  type ImageCacheService,
  type Projection,
  type RecordDetailCommand,
} from "@auktake/ui-contracts";
import { episodeBadge, groupByMonth, ratingLabel } from "../headless/selectors";

function TimelineRow({
  record,
  openDetail,
  imageCache,
}: {
  record: MovieRecord;
  openDetail: RecordDetailCommand | undefined;
  imageCache: ImageCacheService | undefined;
}) {
  const slot = POSTER_PALETTE[colorHash(record.tmdb.title)] ?? POSTER_PALETTE[0]!;
  const badge = episodeBadge(record);
  const tappable = openDetail !== undefined;
  const [uri, setUri] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    const run = async (): Promise<void> => {
      if (record.mediaCache.poster) {
        if (alive) setUri(record.mediaCache.poster);
        return;
      }
      const url = tmdbImageUrl(record.tmdb.posterPath);
      if (!url) return;
      if (imageCache) {
        const local = await imageCache.resolve(url);
        if (local) {
          if (alive) setUri(local);
          return;
        }
      }
      if (alive) setUri(url); // remote direct (aligned with the poster wall)
    };
    void run().catch(() => {
      if (alive) setUri(null);
    });
    return () => {
      alive = false;
    };
  }, [record, imageCache]);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && tappable && styles.rowPressed]}
      disabled={!tappable}
      onPress={tappable ? () => openDetail?.(record.id) : undefined}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: slot.bg }]}>
          <Text style={[styles.thumbText, { color: slot.fg }]} numberOfLines={3}>
            {record.tmdb.title}
          </Text>
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {record.tmdb.title}
        </Text>
        <Text style={styles.rowMeta}>
          {badge ? `${badge} · ` : ""}
          {record.user.watchedAt} · {ratingLabel(record)}
        </Text>
      </View>
    </Pressable>
  );
}

export function createTimelineView(
  projection: Projection<MovieRecord>,
  capabilities: CapabilityRegistry,
  dev: boolean,
): React.ComponentType {
  return function TimelineView() {
    const records = useSyncExternalStore(
      projection.subscribe.bind(projection),
      projection.getState.bind(projection),
    );
    const groups = useMemo(() => groupByMonth(records), [records]);
    const openDetail = capabilities.get<RecordDetailCommand>(CAPABILITY_KEYS.recordDetail);
    const imageCache = capabilities.get<ImageCacheService>(IMAGE_CACHE_SERVICE);
    if (openDetail === undefined && dev) {
      console.warn(
        `[timeline] rows are not tappable: capability "${CAPABILITY_KEYS.recordDetail}" not registered`,
      );
    }

    return (
      <FlatList
        data={groups}
        keyExtractor={(g) => g.month}
        contentContainerStyle={styles.list}
        renderItem={({ item: group }) => (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.records.map((record) => (
              <TimelineRow
                key={record.id}
                record={record}
                openDetail={openDetail}
                imageCache={imageCache}
              />
            ))}
          </View>
        )}
      />
    );
  };
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.lg, backgroundColor: colors.bg },
  group: { gap: spacing.sm },
  groupTitle: {
    fontSize: 16,
    fontWeight: fontWeight.semibold as never,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  rowPressed: { opacity: 0.7 },
  thumb: {
    width: 56,
    height: 84,
    borderRadius: radius.sm,
    padding: spacing.xs,
    justifyContent: "flex-end",
  },
  thumbText: { fontSize: 9, fontWeight: fontWeight.medium as never },
  rowBody: { flex: 1, gap: spacing.xs },
  rowTitle: { fontSize: 16, color: colors.text, fontWeight: fontWeight.medium as never },
  rowMeta: { fontSize: 13, color: colors.textMuted },
});

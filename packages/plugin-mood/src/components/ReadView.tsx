/**
 * Read tab content (headed): mood timeline + review reading cards
 * (design D2). Registered under ui:tab:read; ui-nav hides the tab when
 * the capability is absent.
 */
import React, { useSyncExternalStore } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { MoodEntry, MovieRecord } from "@auktake/core";
import {
  MOOD_EMOJI,
  colors,
  fontWeight,
  radius,
  spacing,
  type MoodKind,
  type Projection,
} from "@auktake/ui-contracts";
import { moodTimeline, reviewCards } from "../headless/mood-store";

export function createReadView(
  records: Projection<MovieRecord>,
  moods: Projection<MoodEntry>,
): React.ComponentType {
  return function ReadView() {
    const allRecords = useSyncExternalStore(
      records.subscribe.bind(records),
      records.getState.bind(records),
    );
    const allMoods = useSyncExternalStore(
      moods.subscribe.bind(moods),
      moods.getState.bind(moods),
    );
    const timeline = moodTimeline(allMoods, allRecords);
    const reviews = reviewCards(allRecords);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>心情时间线</Text>
        {timeline.length === 0 ? (
          <Text style={styles.empty}>还没有心情记录——在详情页点「记心情」留下当下感受</Text>
        ) : (
          timeline.map(({ entry, title, recordMissing }) => (
            <View key={entry.id} style={styles.moodRow}>
              <Text style={styles.moodEmoji}>{MOOD_EMOJI[entry.mood as MoodKind] ?? "・"}</Text>
              <View style={styles.moodBody}>
                <Text style={[styles.moodTitle, recordMissing && styles.moodTitleMissing]}>
                  {title}
                </Text>
                {entry.note ? <Text style={styles.moodNote}>{entry.note}</Text> : null}
                <Text style={styles.moodDate}>{entry.createdAt.slice(0, 10)}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, styles.sectionGap]}>观后感</Text>
        {reviews.length === 0 ? (
          <Text style={styles.empty}>还没有观后感——编辑记录时写下你的想法</Text>
        ) : (
          reviews.map((record) => (
            <View key={record.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewTitle} numberOfLines={1}>
                  {record.tmdb.title}
                </Text>
                <Text style={styles.reviewDate}>{record.user.watchedAt}</Text>
              </View>
              <Text style={styles.reviewText}>{record.user.review}</Text>
            </View>
          ))
        )}
      </ScrollView>
    );
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  sectionGap: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  moodRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moodEmoji: { fontSize: 22, marginRight: spacing.md },
  moodBody: { flex: 1 },
  moodTitle: { color: colors.text, fontSize: 14, fontWeight: fontWeight.medium },
  moodTitleMissing: { color: colors.textMuted },
  moodNote: { color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 19 },
  moodDate: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  reviewTitle: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium, flex: 1 },
  reviewDate: { color: colors.textMuted, fontSize: 11, marginLeft: spacing.md },
  reviewText: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
});

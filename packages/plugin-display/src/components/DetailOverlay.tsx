/**
 * Read-only record detail overlay (headed): mobile bottom sheet /
 * desktop centered card — same-file branch via Platform. Registered
 * under `ui:overlay:record-detail` so it is reachable from ANY tab
 * (poster wall, timeline, calendar day panel). Action buttons only
 * FORWARD edit commands; display owns no mutation logic.
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { MovieRecord } from "@auktake/core";
import type { CapabilityRegistry } from "@auktake/core";
import type { Projection } from "@auktake/ui-contracts";
import {
  CAPABILITY_KEYS,
  MOTION,
  colors,
  type MoodAddCommand,
  type SharePosterCommand,
  type TagListCommand,
  fontWeight,
  radius,
  spacing,
  type RecordDeleteCommand,
  type RecordEditCommand,
} from "@auktake/ui-contracts";
import { episodeBadge, ratingLabel } from "../headless/selectors";
import { useReducedMotion } from "./useReducedMotion";

/** Tiny store for the currently shown detail id. */
export class DetailStore {
  private id: string | null = null;
  private readonly listeners = new Set<() => void>();

  open(id: string): void {
    this.id = id;
    this.notify();
  }

  close(): void {
    this.id = null;
    this.notify();
  }

  get current(): string | null {
    return this.id;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): string | null => this.id;

  private notify(): void {
    for (const l of [...this.listeners]) {
      try {
        l();
      } catch {
        // isolated
      }
    }
  }
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function createDetailOverlay(
  store: DetailStore,
  projection: Projection<MovieRecord>,
  capabilities: CapabilityRegistry,
): React.ComponentType {
  return function DetailOverlay() {
    const id = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const records = useSyncExternalStore(
      projection.subscribe.bind(projection),
      projection.getState.bind(projection),
    );
    const record = id === null ? undefined : records.find((r) => r.id === id);

    const openEditor = capabilities.get<RecordEditCommand>(CAPABILITY_KEYS.recordEdit);
    const requestDelete = capabilities.get<RecordDeleteCommand>(CAPABILITY_KEYS.recordDelete);
    const runBackfill = capabilities.get<(recordId: string) => Promise<unknown>>(
      CAPABILITY_KEYS.tmdbBackfill,
    );
    const tagList = capabilities.get<TagListCommand>(CAPABILITY_KEYS.tagList);
    // Phase 5: mood composer + share poster entries (each hidden when
    // its plugin is absent).
    const moodAdd = capabilities.get<MoodAddCommand>(CAPABILITY_KEYS.moodAdd);
    const sharePoster = capabilities.get<SharePosterCommand>(CAPABILITY_KEYS.sharePoster);
    const [sharing, setSharing] = useState(false);

    // Phase 5: backdrop fade + card rise (Modal animationType="none" so
    // both layers animate independently; reduced motion -> instant).
    const reduced = useReducedMotion();
    const anim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      if (!record) return;
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
    }, [record, reduced, anim]);

    return (
      <Modal
        visible={record !== undefined}
        transparent
        animationType="none"
        onRequestClose={() => store.close()}
      >
        {record ? (
          <View
            style={[
              styles.overlay,
              Platform.OS === "web" ? styles.overlayCenter : styles.overlayBottom,
            ]}
          >
            <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim }]} />
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: anim,
                  transform: [
                    { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                  ],
                },
              ]}
            >
              <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>{record.tmdb.title}</Text>
                {record.tmdb.originalTitle !== record.tmdb.title ? (
                  <Text style={styles.subtitle}>{record.tmdb.originalTitle}</Text>
                ) : null}
                <FieldRow
                  label="类型"
                  value={
                    record.tmdb.mediaType === "episode"
                      ? `剧集 · ${episodeBadge(record)}`
                      : "电影"
                  }
                />
                <FieldRow label="观看日期" value={record.user.watchedAt} />
                <FieldRow label="评分" value={ratingLabel(record)} />
                {record.tmdb.id > 0 ? (
                  <View style={styles.metaBox}>
                    {record.tmdb.genres.length > 0 ? (
                      <FieldRow label="类型标签" value={record.tmdb.genres.map((g) => g.name).join(" / ")} />
                    ) : null}
                    {record.tmdb.runtime > 0 ? (
                      <FieldRow label="片长" value={`${record.tmdb.runtime} 分钟`} />
                    ) : null}
                    {record.tmdb.releaseDate.length > 0 ? (
                      <FieldRow label="上映日期" value={record.tmdb.releaseDate} />
                    ) : null}
                    {record.tmdb.overview.length > 0 ? (
                      <View style={styles.reviewBox}>
                        <Text style={styles.fieldLabel}>简介</Text>
                        <Text style={styles.reviewText}>{record.tmdb.overview}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {record.user.review.length > 0 ? (
                  <View style={styles.reviewBox}>
                    <Text style={styles.fieldLabel}>观后感</Text>
                    <Text style={styles.reviewText}>{record.user.review}</Text>
                  </View>
                ) : null}
              </ScrollView>
              <View style={styles.actions}>
                <Pressable style={styles.closeButton} onPress={() => store.close()}>
                  <Text style={styles.closeText}>关闭</Text>
                </Pressable>
                {record.user.tags.length > 0 && tagList ? (
                  <View style={styles.tagRow}>
                    {record.user.tags
                      .map((id) => tagList().find((t) => t.id === id))
                      .filter((t): t is NonNullable<typeof t> => t !== undefined)
                      .map((tag) => (
                        <View key={tag.id} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>{tag.name}</Text>
                        </View>
                      ))}
                  </View>
                ) : null}
                {record.tmdb.id === 0 && runBackfill ? (
                  <Pressable
                    style={[styles.actionButton, styles.backfillButton]}
                    onPress={() => {
                      store.close();
                      void runBackfill(record.id);
                    }}
                  >
                    <Text style={styles.actionText}>补全元数据</Text>
                  </Pressable>
                ) : null}
                {moodAdd ? (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => {
                      store.close(); // hand over to the mood composer overlay
                      moodAdd(record.id);
                    }}
                  >
                    <Text style={styles.actionText}>记心情</Text>
                  </Pressable>
                ) : null}
                {sharePoster ? (
                  <Pressable
                    style={styles.actionButton}
                    disabled={sharing}
                    onPress={() => {
                      setSharing(true);
                      void sharePoster(record.id)
                        .catch(() => undefined)
                        .finally(() => setSharing(false));
                    }}
                  >
                    <Text style={styles.actionText}>{sharing ? "分享中…" : "分享"}</Text>
                  </Pressable>
                ) : null}
                {openEditor ? (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => {
                      store.close(); // hand over to the editor overlay
                      if (id) openEditor({ recordId: id });
                    }}
                  >
                    <Text style={styles.actionText}>编辑</Text>
                  </Pressable>
                ) : null}
                {requestDelete ? (
                  <Pressable
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => {
                      store.close(); // the delete-confirm dialog takes over
                      if (id) requestDelete(id);
                    }}
                  >
                    <Text style={styles.actionText}>删除</Text>
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
          </View>
        ) : null}
      </Modal>
    );
  };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: spacing.lg },
  backdrop: { backgroundColor: "rgba(0,0,0,0.55)" },
  overlayBottom: { justifyContent: "flex-end" },
  overlayCenter: { alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderRadius: radius.lg,
    maxHeight: "80%",
    width: "100%",
    maxWidth: 480,
  },
  content: { padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 22, fontWeight: fontWeight.bold as never, color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  fieldLabel: { fontSize: 13, color: colors.textMuted },
  fieldValue: { fontSize: 15, color: colors.text, flexShrink: 1, textAlign: "right" },
  reviewBox: { gap: spacing.xs },
  reviewText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  actions: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg },
  closeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  closeText: { color: colors.text, fontWeight: fontWeight.medium as never },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  deleteButton: { backgroundColor: colors.danger },
  backfillButton: { backgroundColor: "#3F6E5A" },
  metaBox: { gap: spacing.md },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tagChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  tagChipText: { fontSize: 12, color: colors.text },
  actionText: { color: "#FFFFFF", fontWeight: fontWeight.semibold as never },
});

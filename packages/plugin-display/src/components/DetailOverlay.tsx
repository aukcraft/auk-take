/**
 * Read-only record detail overlay (headed): mobile bottom sheet /
 * desktop centered card — same-file branch via Platform. Registered
 * under `ui:overlay:record-detail` so it is reachable from ANY tab
 * (poster wall, timeline, calendar day panel). Action buttons only
 * FORWARD edit commands; display owns no mutation logic.
 */
import React, { useSyncExternalStore } from "react";
import {
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
  colors,
  fontWeight,
  radius,
  spacing,
  type RecordDeleteCommand,
  type RecordEditCommand,
} from "@auktake/ui-contracts";
import { episodeBadge, ratingLabel } from "../headless/selectors";

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

    return (
      <Modal
        visible={record !== undefined}
        transparent
        animationType="slide"
        onRequestClose={() => store.close()}
      >
        {record ? (
          <View
            style={[
              styles.overlay,
              Platform.OS === "web" ? styles.overlayCenter : styles.overlayBottom,
            ]}
          >
            <View style={styles.card}>
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
                {openEditor ? (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => {
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
                      if (id) requestDelete(id);
                    }}
                  >
                    <Text style={styles.actionText}>删除</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
    );
  };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: spacing.lg },
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
  actionText: { color: "#FFFFFF", fontWeight: fontWeight.semibold as never },
});

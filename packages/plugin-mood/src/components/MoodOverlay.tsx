/**
 * Mood composer overlay (headed): emoji tier + optional note, appended
 * as a new MoodEntry (history semantics — design D1). Registered under
 * ui:overlay:mood, rendered by the shells' OverlayHost.
 */
import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { MovieRecord } from "@auktake/core";
import {
  MOOD_KINDS,
  MOOD_EMOJI,
  colors,
  fontWeight,
  radius,
  spacing,
  type MoodKind,
  type Projection,
} from "@auktake/ui-contracts";
import type { MoodUiStore } from "../headless/ui-store";

const MOOD_LABELS: Record<MoodKind, string> = {
  love: "超爱",
  ok: "不错",
  meh: "一般",
  bored: "无聊",
  sad: "难过",
};

export function createMoodOverlay(
  ui: MoodUiStore,
  records: Projection<MovieRecord>,
  onSave: (recordId: string, mood: MoodKind, note?: string) => Promise<void>,
): React.ComponentType {
  return function MoodOverlay() {
    const recordId = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
    const all = useSyncExternalStore(records.subscribe.bind(records), records.getState.bind(records));
    const record = recordId === null ? undefined : all.find((r) => r.id === recordId);
    const [mood, setMood] = useState<MoodKind | null>(null);
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (recordId !== null) {
        setMood(null);
        setNote("");
      }
    }, [recordId]);

    if (recordId === null) return null;

    const save = async (): Promise<void> => {
      if (mood === null || saving) return;
      setSaving(true);
      try {
        await onSave(recordId, mood, note);
        ui.close();
      } finally {
        setSaving(false);
      }
    };

    return (
      <Modal visible transparent animationType="fade" onRequestClose={ui.close}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>记心情</Text>
            <Text style={styles.recordTitle} numberOfLines={1}>
              {record?.tmdb.title ?? ""}
            </Text>
            <View style={styles.moodRow}>
              {MOOD_KINDS.map((kind) => (
                <Pressable
                  key={kind}
                  style={[styles.moodChip, mood === kind && styles.moodChipActive]}
                  onPress={() => setMood(kind)}
                  accessibilityLabel={MOOD_LABELS[kind]}
                >
                  <Text style={styles.moodEmoji}>{MOOD_EMOJI[kind]}</Text>
                  <Text
                    style={[styles.moodLabel, mood === kind && styles.moodLabelActive]}
                  >
                    {MOOD_LABELS[kind]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="随手记一句（可选）"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.actions}>
              <Pressable style={styles.cancel} onPress={ui.close}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.save, (mood === null || saving) && { opacity: 0.5 }]}
                disabled={mood === null || saving}
                onPress={() => void save()}
              >
                <Text style={styles.saveText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: fontWeight.semibold },
  recordTitle: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  moodChip: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    minWidth: 56,
  },
  moodChipActive: { borderColor: colors.accent, backgroundColor: colors.surface },
  moodEmoji: { fontSize: 24 },
  moodLabel: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  moodLabelActive: { color: colors.text },
  input: {
    marginTop: spacing.lg,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  cancelText: { color: colors.textMuted, fontSize: 14 },
  save: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: fontWeight.medium },
});

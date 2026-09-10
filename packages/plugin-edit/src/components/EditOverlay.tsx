/**
 * Editor overlay UI (headed): pure RN syntax, single source for both
 * platforms via the RNW alias. RN Modal + KeyboardAvoidingView (an
 * effective no-op on web — see docs/rnw-spike.md). Per-field error
 * feedback; rating 0 renders explicitly as 未评分 (unrated).
 */
import React, { useSyncExternalStore } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontWeight, radius, spacing } from "@auktake/ui-contracts";
import type { EditSessionController } from "../headless/edit-session";
import type { RecordsWriter } from "../headless/records-writer";
import { parseDraft, validateDraft } from "../headless/validation";

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function createEditOverlay(
  session: EditSessionController,
  writer: RecordsWriter,
): React.ComponentType {
  return function EditOverlay() {
    const state = useSyncExternalStore(
      session.subscribe.bind(session),
      session.getState.bind(session),
    );

    const save = async (): Promise<void> => {
      const errors = validateDraft(state.draft);
      if (Object.keys(errors).length > 0) {
        session.setErrors(errors);
        return;
      }
      session.beginSubmit();
      try {
        const draft = parseDraft(state.draft);
        if (state.editingId) {
          await writer.update(state.editingId, draft);
        } else {
          await writer.create(draft);
        }
        session.close();
      } catch (error) {
        console.warn("[edit] save failed", error);
        session.close();
      }
    };

    const confirmDelete = async (): Promise<void> => {
      const prompt = session.takeDeletePrompt();
      if (!prompt) return;
      await writer.remove(prompt.id);
    };

    return (
      <>
        <Modal
          visible={state.status !== "closed"}
          transparent
          animationType="slide"
          onRequestClose={() => session.close()}
        >
          <KeyboardAvoidingView
            style={styles.overlay}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.sheet}>
              <Text style={styles.heading}>
                {state.editingId ? "编辑记录" : "记录观影"}
              </Text>
              <ScrollView style={styles.form}>
                <Field label="标题" error={state.errors.title}>
                  <TextInput
                    {...inputProps}
                    value={state.draft.title}
                    onChangeText={(v) => session.setField("title", v)}
                    placeholder="影片 / 剧集标题"
                  />
                </Field>
                <Field label="原题（可选）" error={state.errors.originalTitle}>
                  <TextInput
                    {...inputProps}
                    value={state.draft.originalTitle}
                    onChangeText={(v) => session.setField("originalTitle", v)}
                    placeholder="留空则与标题相同"
                  />
                </Field>
                <Field label="类型">
                  <View style={styles.segment}>
                    {(["movie", "episode"] as const).map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => session.setMediaType(t)}
                        style={[styles.segItem, state.draft.mediaType === t && styles.segActive]}
                      >
                        <Text
                          style={[styles.segText, state.draft.mediaType === t && styles.segTextActive]}
                        >
                          {t === "movie" ? "电影" : "剧集"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Field>
                {state.draft.mediaType === "episode" ? (
                  <View style={styles.row}>
                    <View style={styles.rowItem}>
                      <Field label="季" error={state.errors.seasonNumber}>
                        <TextInput
                          {...inputProps}
                          value={state.draft.seasonNumber}
                          onChangeText={(v) => session.setField("seasonNumber", v)}
                          keyboardType="number-pad"
                          placeholder="2"
                        />
                      </Field>
                    </View>
                    <View style={styles.rowItem}>
                      <Field label="集" error={state.errors.episodeNumber}>
                        <TextInput
                          {...inputProps}
                          value={state.draft.episodeNumber}
                          onChangeText={(v) => session.setField("episodeNumber", v)}
                          keyboardType="number-pad"
                          placeholder="5"
                        />
                      </Field>
                    </View>
                  </View>
                ) : null}
                <Field label="观看日期" error={state.errors.watchedAt}>
                  <TextInput
                    {...inputProps}
                    value={state.draft.watchedAt}
                    onChangeText={(v) => session.setField("watchedAt", v)}
                    placeholder="YYYY-MM-DD"
                  />
                </Field>
                <Field label="评分（0–10，步进 0.5；留空 = 未评分）" error={state.errors.rating}>
                  <TextInput
                    {...inputProps}
                    value={state.draft.rating}
                    onChangeText={(v) => session.setField("rating", v)}
                    keyboardType="decimal-pad"
                    placeholder="8.5"
                  />
                </Field>
                <Field label="观后感（可选）">
                  <TextInput
                    {...inputProps}
                    value={state.draft.review}
                    onChangeText={(v) => session.setField("review", v)}
                    multiline
                    placeholder="写下此刻的感受…"
                  />
                </Field>
              </ScrollView>
              <View style={styles.actions}>
                <Pressable style={styles.cancel} onPress={() => session.close()}>
                  <Text style={styles.cancelText}>取消</Text>
                </Pressable>
                <Pressable
                  style={[styles.save, state.status === "submitting" && styles.disabled]}
                  disabled={state.status === "submitting"}
                  onPress={() => void save()}
                >
                  <Text style={styles.saveText}>
                    {state.status === "submitting" ? "保存中…" : "保存"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={state.deletePrompt !== null}
          transparent
          animationType="fade"
          onRequestClose={() => session.cancelDelete()}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>删除记录</Text>
              <Text style={styles.confirmBody}>
                确定删除「{state.deletePrompt?.title ?? ""}」吗？此操作不可撤销。
              </Text>
              <View style={styles.actions}>
                <Pressable style={styles.cancel} onPress={() => session.cancelDelete()}>
                  <Text style={styles.cancelText}>取消</Text>
                </Pressable>
                <Pressable
                  style={styles.delete}
                  onPress={() => void confirmDelete()}
                >
                  <Text style={styles.saveText}>删除</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  heading: { fontSize: 20, fontWeight: fontWeight.bold, color: colors.text },
  form: { flexGrow: 0 },
  field: { gap: spacing.xs, marginBottom: spacing.md },
  label: { fontSize: 13, color: colors.textMuted },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: 15,
  },
  error: { fontSize: 12, color: colors.danger },
  segment: { flexDirection: "row", gap: spacing.sm },
  segItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  segActive: { backgroundColor: colors.accent },
  segText: { color: colors.textMuted },
  segTextActive: { color: "#FFFFFF", fontWeight: fontWeight.semibold },
  row: { flexDirection: "row", gap: spacing.md },
  rowItem: { flex: 1 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  cancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  cancelText: { color: colors.text, fontWeight: fontWeight.medium },
  save: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  delete: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: "center",
  },
  disabled: { opacity: 0.6 },
  saveText: { color: "#FFFFFF", fontWeight: fontWeight.semibold },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  confirmCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 420,
    gap: spacing.md,
  },
  confirmTitle: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.text },
  confirmBody: { color: colors.textMuted, fontSize: 15 },
});

const inputProps = {
  style: styles.input,
  placeholderTextColor: colors.textMuted,
  underlineColorAndroid: "transparent",
} as const;

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
import type { TmdbSnapshot } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  colors,
  fontWeight,
  radius,
  spacing,
  type ImageCacheService,
  type TmdbCandidate,
  type TmdbCandidateSnapshotCommand,
} from "@auktake/ui-contracts";
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
  warmPoster: (recordId: string, posterPath: string) => void,
  capabilities?: { get: <T>(key: string) => T | undefined },
  _imageCache?: ImageCacheService,
): React.ComponentType {
  return function EditOverlay() {
    const state = useSyncExternalStore(
      session.subscribe.bind(session),
      session.getState.bind(session),
    );
    const [searchText, setSearchText] = React.useState("");
    const [candidates, setCandidates] = React.useState<TmdbCandidate[]>([]);
    const [searching, setSearching] = React.useState(false);

    const search = capabilities?.get<TmdbCandidateSnapshotCommand>(CAPABILITY_KEYS.tmdbCandidateSnapshot);
    // search capability resolution: tmdb plugin exports cmd:tmdb-search
    const tmdbSearch = capabilities?.get<
      (q: string, o?: { mediaType?: "movie" | "episode" }) => Promise<TmdbCandidate[]>
    >(CAPABILITY_KEYS.tmdbSearch);

    const save = async (): Promise<void> => {
      const errors = validateDraft(state.draft);
      if (Object.keys(errors).length > 0) {
        session.setErrors(errors);
        return;
      }
      session.beginSubmit();
      try {
        const draft = parseDraft(state.draft);
        const directive = state.unbound
          ? { keep: false, unbind: true }
          : state.pendingTmdb
            ? { keep: false, snapshot: state.pendingTmdb }
            : undefined;
        let savedId: string | undefined;
        if (state.editingId) {
          const updated = await writer.update(state.editingId, draft, directive);
          savedId = updated?.id;
        } else {
          const created = await writer.create(draft, state.pendingTmdb ?? undefined);
          savedId = created.id;
        }
        const poster = (state.unbound ? "" : state.pendingTmdb?.posterPath) ?? "";
        if (savedId && poster) warmPoster(savedId, poster);
        session.close();
      } catch (error) {
        // Storage/persist failure MUST be visible, never a silent close.
        console.warn("[edit] save failed", error);
        session.failSubmit("保存失败：数据未能写入磁盘，请重试；详情见控制台日志");
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
                {tmdbSearch && !state.unbound ? (
                  <View style={styles.tmdbBox}>
                    {state.pendingTmdb ? (
                      <View style={styles.boundRow}>
                        <Text style={styles.boundText} numberOfLines={1}>
                          TMDB 已绑定：{state.pendingTmdb.title}
                          {state.pendingTmdb.releaseDate
                            ? ` (${state.pendingTmdb.releaseDate.slice(0, 4)})`
                            : ""}
                        </Text>
                        <Pressable style={styles.unbind} onPress={() => session.unbindTmdb()}>
                          <Text style={styles.unbindText}>解绑</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <View style={styles.searchRow}>
                          <TextInput
                            style={styles.searchInput}
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="搜索 TMDB 绑定元数据（可选）"
                            placeholderTextColor={colors.textMuted}
                          />
                          <Pressable
                            style={[styles.searchBtn, searching && { opacity: 0.6 }]}
                            disabled={searching || searchText.trim().length === 0}
                            onPress={async () => {
                              setSearching(true);
                              try {
                                const found = await tmdbSearch?.(searchText.trim(), {
                                  mediaType: state.draft.mediaType,
                                });
                                setCandidates(found ?? []);
                              } finally {
                                setSearching(false);
                              }
                            }}
                          >
                            <Text style={styles.searchBtnText}>
                              {searching ? "…" : "搜索"}
                            </Text>
                          </Pressable>
                        </View>
                        {candidates.map((c) => (
                          <Pressable
                            key={`${c.tmdbId}-${c.mediaType}`}
                            style={styles.candidate}
                            onPress={async () => {
                              if (!search) return;
                              const episode =
                                state.draft.mediaType === "episode"
                                  ? {
                                      season: Number(state.draft.seasonNumber) || 1,
                                      episode: Number(state.draft.episodeNumber) || 1,
                                    }
                                  : undefined;
                              const snapshot: TmdbSnapshot = await search(c, episode);
                              session.setPendingTmdb(snapshot);
                              setCandidates([]);
                            }}
                          >
                            <Text style={styles.candidateTitle} numberOfLines={1}>
                              {c.title}
                            </Text>
                            <Text style={styles.candidateMeta} numberOfLines={1}>
                              {c.mediaType === "episode" ? "剧集" : "电影"}
                              {c.releaseDate ? ` · ${c.releaseDate.slice(0, 4)}` : ""}
                            </Text>
                          </Pressable>
                        ))}
                        {candidates.length === 0 && searching === false && null}
                      </>
                    )}
                  </View>
                ) : null}
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
                <Field label={`观后感${state.draft.review.length > 0 ? ` · ${state.draft.review.length} 字` : ""}`}>
                  <TextInput
                    {...inputProps}
                    style={styles.reviewInput}
                    value={state.draft.review}
                    onChangeText={(v) => session.setField("review", v)}
                    multiline
                    numberOfLines={6}
                    placeholder="这部作品哪里打动了你？记住此刻的感受——观后感是 AukTake 的核心。"
                  />
                </Field>
              </ScrollView>
              {state.formError ? <Text style={styles.formError}>{state.formError}</Text> : null}
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
  tmdbBox: { gap: spacing.xs, marginBottom: spacing.md },
  boundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
  },
  boundText: { flex: 1, fontSize: 13, color: colors.text },
  unbind: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  unbindText: { color: colors.danger, fontSize: 13 },
  searchRow: { flexDirection: "row", gap: spacing.sm },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: 14,
  },
  searchBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  searchBtnText: { color: "#FFFFFF", fontSize: 14 },
  candidate: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
  },
  candidateTitle: { fontSize: 14, color: colors.text, fontWeight: fontWeight.medium as never },
  candidateMeta: { fontSize: 12, color: colors.textMuted },
  formError: { fontSize: 13, color: colors.danger, textAlign: "center" },
  reviewInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 132,
    textAlignVertical: "top",
  },
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

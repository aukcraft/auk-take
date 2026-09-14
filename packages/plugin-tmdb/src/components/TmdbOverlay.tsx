/**
 * tmdb overlay surfaces (headed, pure RN syntax): credential/language
 * config dialog + backfill needs-review candidate chooser. Registered
 * under ui:overlay:tmdb-backfill and rendered by the shells' generic
 * OverlayHost.
 */
import React, { useState, useSyncExternalStore } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontWeight, radius, spacing, type TmdbCandidate } from "@auktake/ui-contracts";
import type { TmdbUiStore } from "../headless/ui-store";

function CandidateRow({
  candidate,
  onPick,
}: {
  candidate: TmdbCandidate;
  onPick: () => void;
}) {
  const year = candidate.releaseDate.slice(0, 4);
  return (
    <Pressable
      style={({ pressed }) => [styles.candidate, pressed && { opacity: 0.7 }]}
      onPress={onPick}
    >
      <View style={styles.candidateBody}>
        <Text style={styles.candidateTitle} numberOfLines={1}>
          {candidate.title}
        </Text>
        <Text style={styles.candidateMeta} numberOfLines={1}>
          {candidate.mediaType === "episode" ? "剧集" : "电影"}
          {year ? ` · ${year}` : ""}
          {candidate.originalTitle && candidate.originalTitle !== candidate.title
            ? ` · ${candidate.originalTitle}`
            : ""}
        </Text>
      </View>
    </Pressable>
  );
}

export function createTmdbOverlay(
  ui: TmdbUiStore,
  onReviewPick: (recordId: string, candidate: TmdbCandidate) => Promise<void>,
  config: { apiKey: string; v4Token?: string; language: string },
  onSaveConfig: (next: { apiKey: string; v4Token?: string; language: string }) => Promise<void>,
): React.ComponentType {
  return function TmdbOverlay() {
    const state = useSyncExternalStore(ui.subscribe, ui.getState);
    const [apiKey, setApiKey] = useState(config.apiKey);
    const [v4Token, setV4Token] = useState(config.v4Token ?? "");
    const [language, setLanguage] = useState(config.language);
    const [saving, setSaving] = useState(false);

    return (
      <>
        <Modal
          visible={state.configOpen}
          transparent
          animationType="fade"
          onRequestClose={() => ui.closeConfig()}
        >
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.title}>TMDB 设置</Text>
              <Text style={styles.label}>API Key v3（可选，32 位十六进制）</Text>
              <TextInput
                style={styles.input}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="留空 = 使用 v4 令牌或内置配置"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.label}>Read Access Token v4（推荐，以 eyJ 开头的长串）</Text>
              <TextInput
                style={styles.input}
                value={v4Token}
                onChangeText={setV4Token}
                placeholder="eyJ…（加密存储于本机）"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              <Text style={styles.hint}>
                从 themoviedb.org/settings/api 的「API Read Access Token」完整复制（勿用 32 位 API Key）；填错框会自动归位。凭证经本机加密持久化。
              </Text>
              <Text style={styles.label}>语言偏好</Text>
              <TextInput
                style={styles.input}
                value={language}
                onChangeText={setLanguage}
                placeholder="zh-CN"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.actions}>
                <Pressable style={styles.cancel} onPress={() => ui.closeConfig()}>
                  <Text style={styles.cancelText}>取消</Text>
                </Pressable>
                <Pressable
                  style={[styles.save, saving && { opacity: 0.6 }]}
                  disabled={saving}
                  onPress={async () => {
                    setSaving(true);
                    await onSaveConfig({
                      apiKey: apiKey.trim(),
                      v4Token: v4Token.trim(),
                      language: language.trim() || "zh-CN",
                    });
                    setSaving(false);
                    ui.closeConfig();
                  }}
                >
                  <Text style={styles.saveText}>保存</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={state.review !== null}
          transparent
          animationType="slide"
          onRequestClose={() => ui.closeReview()}
        >
          <View style={[styles.overlay, styles.reviewOverlay]}>
            <View style={styles.reviewCard}>
              <Text style={styles.title}>选择匹配的条目</Text>
              <ScrollView style={{ flexGrow: 0 }}>
                {state.review?.candidates.map((c) => (
                  <CandidateRow
                    key={`${c.tmdbId}-${c.mediaType}`}
                    candidate={c}
                    onPick={() => {
                      const id = state.review?.recordId;
                      if (id) void onReviewPick(id, c);
                    }}
                  />
                ))}
              </ScrollView>
              <Pressable style={styles.cancel} onPress={() => ui.closeReview()}>
                <Text style={styles.cancelText}>跳过</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </>
    );
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  reviewOverlay: { justifyContent: "flex-end" },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 420,
    gap: spacing.md,
  },
  reviewCard: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 480,
    maxHeight: "80%",
    gap: spacing.md,
  },
  title: { fontSize: 18, fontWeight: fontWeight.bold as never, color: colors.text },
  label: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 11, color: colors.textMuted, opacity: 0.8 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: 15,
  },
  candidate: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  candidateBody: { gap: 2 },
  candidateTitle: { fontSize: 16, color: colors.text, fontWeight: fontWeight.medium as never },
  candidateMeta: { fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.md },
  cancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  cancelText: { color: colors.text, fontWeight: fontWeight.medium as never },
  save: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  saveText: { color: "#FFFFFF", fontWeight: fontWeight.semibold as never },
});

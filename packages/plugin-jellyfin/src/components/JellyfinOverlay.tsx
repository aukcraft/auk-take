/**
 * Jellyfin overlay (headed): server/credential config dialog with
 * save-time connectivity verification. Registered under
 * ui:overlay:jellyfin and rendered by the shells' OverlayHost.
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
import { HttpError, colors, fontWeight, radius, spacing } from "@auktake/ui-contracts";
import type { JellyfinSystemInfo } from "../headless/jellyfin-client";

export class JellyfinUiStore {
  private open = false;
  private readonly listeners = new Set<() => void>();

  openDialog = (): void => {
    this.open = true;
    this.notify();
  };

  closeDialog = (): void => {
    this.open = false;
    this.notify();
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): boolean => this.open;

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

export function createJellyfinOverlay(
  ui: JellyfinUiStore,
  getConfig: () => { baseUrl: string; apiKey: string },
  onSaveConfig: (config: { baseUrl: string; apiKey: string }) => Promise<void>,
  verify: (config: { baseUrl: string; apiKey: string }) => Promise<JellyfinSystemInfo>,
): React.ComponentType {
  return function JellyfinOverlay() {
    const open = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
    const [baseUrl, setBaseUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [status, setStatus] = useState<{ kind: "idle" | "ok" | "error"; text: string }>({
      kind: "idle",
      text: "",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (open) {
        const live = getConfig();
        setBaseUrl(live.baseUrl);
        setApiKey(live.apiKey);
        setStatus({ kind: "idle", text: "" });
      }
    }, [open, getConfig]);

    if (!open) return null;

    const save = async (): Promise<void> => {
      setSaving(true);
      setStatus({ kind: "idle", text: "验证中…" });
      try {
        const info = await verify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
        await onSaveConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
        setStatus({
          kind: "ok",
          text: `已连接：${info.ServerName ?? "Jellyfin"}${info.Version ? `（v${info.Version}）` : ""}`,
        });
      } catch (error) {
        const hint =
          error instanceof HttpError && error.kind === "status" && error.status === 401
            ? "API Key 被拒绝（401）"
            : error instanceof HttpError && error.kind === "network"
              ? "无法连接服务器（网络错误）"
              : error instanceof HttpError && error.kind === "timeout"
                ? "连接超时"
                : "未知错误，详见控制台";
        console.warn("[jellyfin] verify failed", error);
        setStatus({ kind: "error", text: `验证失败：${hint}` });
      } finally {
        setSaving(false);
      }
    };

    return (
      <Modal visible transparent animationType="fade" onRequestClose={ui.closeDialog}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Jellyfin 同步设置</Text>
            <Text style={styles.label}>服务器地址</Text>
            <TextInput
              style={styles.input}
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="https://jellyfin.example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>API Key（Jellyfin 后台 → API Keys 生成）</Text>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="粘贴 API Key"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {status.kind !== "idle" ? (
              <Text style={status.kind === "ok" ? styles.okText : styles.errText}>
                {status.text}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable style={styles.cancel} onPress={ui.closeDialog}>
                <Text style={styles.cancelText}>关闭</Text>
              </Pressable>
              <Pressable
                style={[styles.save, saving && { opacity: 0.6 }]}
                disabled={saving || baseUrl.trim().length === 0 || apiKey.trim().length === 0}
                onPress={() => void save()}
              >
                <Text style={styles.saveText}>{saving ? "验证中…" : "保存并验证"}</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>API Key 经本机加密持久化，不会明文落盘。</Text>
          </View>
        </View>
      </Modal>
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
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 440,
    gap: spacing.md,
  },
  title: { fontSize: 18, fontWeight: fontWeight.bold as never, color: colors.text },
  label: { fontSize: 13, color: colors.textMuted },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: 15,
  },
  okText: { fontSize: 13, color: "#5BB98C" },
  errText: { fontSize: 13, color: colors.danger },
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
  hint: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
});

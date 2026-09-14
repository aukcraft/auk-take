/**
 * Search toolbar (headed, pure RN syntax): debounced search input +
 * expandable filter panel (tags via cmd:tag-list, rating range, type,
 * date range) + active-count badge + reset. Pure presentational over
 * the RecordQuery passed in; engine lives in the search plugin.
 */
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { CapabilityRegistry } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  colors,
  fontWeight,
  radius,
  spacing,
  type RecordQuery,
  type TagListCommand,
} from "@auktake/ui-contracts";
import { activeFilterCount, debounce } from "@auktake/ui-contracts";

const RATING_CHOICES = [
  { label: "全部", range: null },
  { label: "≥ 6", range: { min: 6, max: 10 } },
  { label: "≥ 8", range: { min: 8, max: 10 } },
  { label: "9–10", range: { min: 9, max: 10 } },
  { label: "未评分", range: { min: 0, max: 0 } },
] as const;

function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function createSearchToolbar(
  capabilities: CapabilityRegistry,
): React.ComponentType<{ query: RecordQuery; onChange: (next: RecordQuery) => void }> {
  return function SearchToolbar({ query, onChange }: {
    query: RecordQuery;
    onChange: (next: RecordQuery) => void;
  }) {
    const [input, setInput] = useState(query.text ?? "");
    const [panelOpen, setPanelOpen] = useState(false);
    const tagList = capabilities.get<TagListCommand>(CAPABILITY_KEYS.tagList);
    const tags = useMemo(() => tagList?.() ?? [], [tagList]);

    const commitText = useMemo(
      () =>
        debounce((text: string) => {
          onChange({ ...query, text: text.trim().length === 0 ? undefined : text });
        }, 300),
      [query, onChange],
    );

    const count = activeFilterCount(query);
    const toggleTag = (id: string): void => {
      const current = query.tagIds ?? [];
      onChange({
        ...query,
        tagIds: current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
      });
    };

    return (
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(v) => {
            setInput(v);
            commitText(v);
          }}
          placeholder="搜索标题 / 原题…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />
        <Pressable
          style={[styles.filterBtn, count > 0 && styles.filterBtnActive]}
          onPress={() => setPanelOpen(true)}
          accessibilityLabel="筛选"
        >
          <Text style={[styles.filterBtnText, count > 0 && styles.filterBtnTextActive]}>
            筛选{count > 0 ? ` ${count}` : ""}
          </Text>
        </Pressable>

        <Modal
          visible={panelOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setPanelOpen(false)}
        >
          <Pressable
            style={styles.panelOverlay}
            onPress={() => setPanelOpen(false)}
          >
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>筛选</Text>

              {tags.length > 0 ? (
                <>
                  <Text style={styles.section}>标签（多选）</Text>
                  <View style={styles.choices}>
                    {tags.map((tag) => (
                      <Choice
                        key={tag.id}
                        label={tag.name}
                        active={(query.tagIds ?? []).includes(tag.id)}
                        onPress={() => toggleTag(tag.id)}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.section}>评分</Text>
              <View style={styles.choices}>
                {RATING_CHOICES.map(({ label, range }) => {
                  const active = range === null ? !query.ratingRange : JSON.stringify(query.ratingRange) === JSON.stringify(range);
                  return (
                    <Choice
                      key={label}
                      label={label}
                      active={active}
                      onPress={() =>
                        onChange({ ...query, ratingRange: range ?? undefined })
                      }
                    />
                  );
                })}
              </View>

              <Text style={styles.section}>类型</Text>
              <View style={styles.choices}>
                {(["movie", "episode"] as const).map((t) => (
                  <Choice
                    key={t}
                    label={t === "movie" ? "电影" : "剧集"}
                    active={query.mediaType === t}
                    onPress={() =>
                      onChange({ ...query, mediaType: query.mediaType === t ? undefined : t })
                    }
                  />
                ))}
              </View>

              <Text style={styles.section}>日期范围</Text>
              <View style={styles.dateRow}>
                <TextInput
                  style={styles.dateInput}
                  value={query.dateRange?.from ?? ""}
                  onChangeText={(v) =>
                    onChange({
                      ...query,
                      dateRange: {
                        from: v,
                        to: query.dateRange?.to ?? "9999-12-31",
                      },
                    })
                  }
                  placeholder="从 YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.dateDash}>–</Text>
                <TextInput
                  style={styles.dateInput}
                  value={query.dateRange?.to ?? ""}
                  onChangeText={(v) =>
                    onChange({
                      ...query,
                      dateRange: {
                        from: query.dateRange?.from ?? "0000-01-01",
                        to: v,
                      },
                    })
                  }
                  placeholder="至 YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Pressable
                style={styles.resetBtn}
                onPress={() => {
                  setInput("");
                  onChange({});
                  setPanelOpen(false);
                }}
              >
                <Text style={styles.resetText}>清除全部筛选</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  };
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, flex: 1 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    color: colors.text,
    fontSize: 14,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterBtnText: { fontSize: 13, color: colors.textMuted },
  filterBtnTextActive: { color: "#FFFFFF", fontWeight: fontWeight.medium as never },
  panelOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    alignItems: "center",
    padding: spacing.lg,
  },
  panel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 480,
    maxHeight: "85%",
    gap: spacing.md,
  },
  panelTitle: { fontSize: 18, fontWeight: fontWeight.bold as never, color: colors.text },
  section: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  choice: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { fontSize: 13, color: colors.text },
  choiceTextActive: { color: "#FFFFFF" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dateInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    color: colors.text,
    fontSize: 13,
  },
  dateDash: { color: colors.textMuted },
  resetBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  resetText: { color: colors.text, fontWeight: fontWeight.medium as never },
});

/**
 * Search suite (headed, pure RN syntax).
 *
 * The capability value is a factory: createSearchSuite(capabilities)
 * => { Button, Card } — a STABLE component pair sharing an internal
 * open-state store; query state flows via props from the consumer:
 *
 *   const suite = createSearchSuite(capabilities);
 *   <suite.Button query={query} onChange={setQuery} />
 *   <suite.Card   query={query} onChange={setQuery} />
 *
 * - Button: search-icon entry + active-condition pills ("Text: 关键词",
 *   "Time: a~b", "Tag: 科幻", …); a pill's × removes that condition and
 *   re-filters immediately.
 * - Card: small modal composing conditions (keyword, date range, tags,
 *   rating, type). v1 combination semantics: AND only.
 */
import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { CapabilityRegistry } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  activeFilterCount,
  colors,
  debounce,
  fontWeight,
  radius,
  spacing,
  type RecordQuery,
  type TagListCommand,
} from "@auktake/ui-contracts";

const RATING_CHOICES = [
  { label: "≥ 6", range: { min: 6, max: 10 } },
  { label: "≥ 8", range: { min: 8, max: 10 } },
  { label: "9–10", range: { min: 9, max: 10 } },
  { label: "未评分", range: { min: 0, max: 0 } },
] as const;

function ratingPillLabel(range: { min: number; max: number }): string {
  if (range.min === 0 && range.max === 0) return "未评分";
  if (range.min === range.max) return `${range.min}`;
  if (range.max >= 10) return `≥ ${range.min}`;
  return `${range.min}–${range.max}`;
}

/** Open-state shared between the Button and the Card instances. */
class OpenStore {
  private open = false;
  private readonly listeners = new Set<() => void>();

  openCard = (): void => {
    this.open = true;
    this.notify();
  };

  closeCard = (): void => {
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

/** Set once per factory invocation (single suite per app). */
let suiteCapabilities: CapabilityRegistry | null = null;
let suiteOpen: OpenStore | null = null;

export interface SearchSuiteProps {
  readonly query: RecordQuery;
  readonly onChange: (next: RecordQuery) => void;
}

function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText} numberOfLines={1}>
        {label}
      </Text>
      <Pressable onPress={onRemove} hitSlop={6} accessibilityLabel={`移除条件 ${label}`}>
        <Text style={styles.pillX}>×</Text>
      </Pressable>
    </View>
  );
}

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

/**
 * Tuple API (user contract):
 *
 *   const [SearchButton, SearchCard] = createSearchSuite({ query, onChange });
 *
 * Each invocation refreshes the captured props and returns the SAME
 * stable component references (state inside the card survives
 * re-invocations; display typically re-invokes inside useMemo as the
 * query changes).
 */
export function createSearchSuite(
  capabilities: CapabilityRegistry,
): (props: SearchSuiteProps) => readonly [React.ComponentType, React.ComponentType] {
  const open = new OpenStore();
  suiteCapabilities = capabilities;
  suiteOpen = open;
  const propsRef: { current: SearchSuiteProps } = {
    current: { query: {}, onChange: () => {} },
  };

  const Button = function SearchButtonProxy() {
    return <SearchButtonInner {...propsRef.current} />;
  };
  const Card = function SearchCardProxy() {
    return <SearchCardInner open={open} {...propsRef.current} />;
  };

  return ({ query, onChange }) => {
    propsRef.current = { query, onChange };
    return [Button, Card] as const;
  };
}

function SearchButtonInner({ query, onChange }: SearchSuiteProps) {
  const capabilities = suiteCapabilities!;
  const tagList = capabilities.get<TagListCommand>(CAPABILITY_KEYS.tagList);
  const tags = useMemo(() => tagList?.() ?? [], [tagList]);
  const tagName = (id: string): string => tags.find((t) => t.id === id)?.name ?? id;

  return (
    <View style={styles.buttonWrap}>
      <Pressable
        style={[styles.iconBtn, activeFilterCount(query) > 0 && styles.iconBtnActive]}
        onPress={suiteOpen!.openCard}
        accessibilityLabel="搜索"
        accessibilityRole="button"
      >
        <Text style={styles.iconText}>⌕</Text>
      </Pressable>
      {(query.tagIds ?? []).map((id) => (
        <Pill
          key={`tag-${id}`}
          label={`Tag: ${tagName(id)}`}
          onRemove={() =>
            onChange({ ...query, tagIds: (query.tagIds ?? []).filter((t) => t !== id) })
          }
        />
      ))}
      {query.text ? (
        <Pill
          label={`Text: ${query.text}`}
          onRemove={() => onChange({ ...query, text: undefined })}
        />
      ) : null}
      {query.dateRange ? (
        <Pill
          label={`Time: ${query.dateRange.from}~${query.dateRange.to}`}
          onRemove={() => onChange({ ...query, dateRange: undefined })}
        />
      ) : null}
      {query.ratingRange ? (
        <Pill
          label={`评分 ${ratingPillLabel(query.ratingRange)}`}
          onRemove={() => onChange({ ...query, ratingRange: undefined })}
        />
      ) : null}
      {query.mediaType ? (
        <Pill
          label={`类型: ${query.mediaType === "movie" ? "电影" : "剧集"}`}
          onRemove={() => onChange({ ...query, mediaType: undefined })}
        />
      ) : null}
    </View>
  );
}

function SearchCardInner({
  query,
  onChange,
  open,
}: SearchSuiteProps & { open: OpenStore }) {
  const capabilities = suiteCapabilities!;
  const isOpen = useSyncExternalStore(open.subscribe, open.getSnapshot);
  const tagList = capabilities.get<TagListCommand>(CAPABILITY_KEYS.tagList);
  const tags = useMemo(() => tagList?.() ?? [], [tagList]);

  const [text, setText] = useState(query.text ?? "");
  const [from, setFrom] = useState(query.dateRange?.from ?? "");
  const [to, setTo] = useState(query.dateRange?.to ?? "");
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setText(query.text ?? "");
    setFrom(query.dateRange?.from ?? "");
    setTo(query.dateRange?.to ?? "");
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  const commitText = useMemo(
    () =>
      debounce((value: string) => {
        onChange({ ...query, text: value.trim().length === 0 ? undefined : value });
      }, 300),
    [query, onChange],
  );

  const apply = (): void => {
    onChange({
      ...query,
      text: text.trim().length === 0 ? undefined : text.trim(),
      dateRange:
        from.trim().length > 0 || to.trim().length > 0
          ? { from: from.trim() || "0000-01-01", to: to.trim() || "9999-12-31" }
          : undefined,
    });
    open.closeCard();
  };

  if (!isOpen) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={open.closeCard}>
      <Pressable style={styles.cardOverlay} onPress={open.closeCard}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.cardTitle}>搜索</Text>

          <Text style={styles.section}>关键词（标题 / 原题）</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(v) => {
              setText(v);
              commitText(v);
            }}
            placeholder="输入关键词…"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={apply}
          />

          <Text style={styles.section}>日期范围</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={styles.dateInput}
              value={from}
              onChangeText={setFrom}
              placeholder="从 YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.dateDash}>–</Text>
            <TextInput
              style={styles.dateInput}
              value={to}
              onChangeText={setTo}
              placeholder="至 YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {tags.length > 0 ? (
            <>
              <Text style={styles.section}>标签（多选，全部满足）</Text>
              <View style={styles.choices}>
                {tags.map((tag) => {
                  const active = (query.tagIds ?? []).includes(tag.id);
                  return (
                    <Choice
                      key={tag.id}
                      label={tag.name}
                      active={active}
                      onPress={() =>
                        onChange({
                          ...query,
                          tagIds: active
                            ? (query.tagIds ?? []).filter((t) => t !== tag.id)
                            : [...(query.tagIds ?? []), tag.id],
                        })
                      }
                    />
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.section}>评分</Text>
          <View style={styles.choices}>
            <Choice
              label="全部"
              active={!query.ratingRange}
              onPress={() => onChange({ ...query, ratingRange: undefined })}
            />
            {RATING_CHOICES.map(({ label, range }) => (
              <Choice
                key={label}
                label={label}
                active={
                  !!query.ratingRange &&
                  query.ratingRange.min === range.min &&
                  query.ratingRange.max === range.max
                }
                onPress={() => onChange({ ...query, ratingRange: { ...range } })}
              />
            ))}
          </View>

          <Text style={styles.section}>类型</Text>
          <View style={styles.choices}>
            {(["movie", "episode"] as const).map((t) => (
              <Choice
                key={t}
                label={t === "movie" ? "电影" : "剧集"}
                active={query.mediaType === t}
                onPress={() =>
                  onChange({
                    ...query,
                    mediaType: query.mediaType === t ? undefined : t,
                  })
                }
              />
            ))}
          </View>

          <View style={styles.cardActions}>
            <Pressable
              style={styles.clearBtn}
              onPress={() => {
                setText("");
                setFrom("");
                setTo("");
                onChange({});
              }}
            >
              <Text style={styles.clearText}>清空条件</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={apply}>
              <Text style={styles.applyText}>搜索</Text>
            </Pressable>
          </View>
          <Text style={styles.andHint}>多个条件为「同时满足」关系</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  buttonWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    flex: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: { borderColor: colors.accent },
  iconText: { fontSize: 18, color: colors.text, lineHeight: 22 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    maxWidth: 220,
  },
  pillText: { fontSize: 12, color: colors.text },
  pillX: { fontSize: 14, color: colors.textMuted },
  cardOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 440,
    gap: spacing.md,
  },
  cardTitle: { fontSize: 18, fontWeight: fontWeight.bold as never, color: colors.text },
  section: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: 15,
  },
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
  cardActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  clearBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  clearText: { color: colors.text, fontWeight: fontWeight.medium as never },
  applyBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  applyText: { color: "#FFFFFF", fontWeight: fontWeight.semibold as never },
  andHint: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
});

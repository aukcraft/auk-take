/**
 * Tag picker (headed, pure RN syntax): multi-select chips + inline
 * create. Props follow the ui-contracts TagPickerProps contract; the
 * component closes over the tag command family via its factory.
 */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  colors,
  fontWeight,
  radius,
  spacing,
  type Tag,
  type TagPickerProps,
} from "@auktake/ui-contracts";

export function createTagPicker(
  listTags: () => readonly Tag[],
  subscribeTags: (listener: () => void) => () => void,
): React.ComponentType<TagPickerProps> {
  return function TagPicker({ selectedIds, onChange, onCreate }: TagPickerProps) {
    const [tags, setTags] = useState<readonly Tag[]>(listTags);
    useEffect(() => subscribeTags(() => setTags(listTags)), [listTags, subscribeTags]);

    const [creating, setCreating] = useState(false);
    const [name, setName] = useState("");

    const toggle = (id: string): void => {
      onChange(
        selectedIds.includes(id)
          ? selectedIds.filter((t) => t !== id)
          : [...selectedIds, id],
      );
    };

    const submit = async (): Promise<void> => {
      const trimmed = name.trim();
      if (trimmed.length === 0 || !onCreate) return;
      const tag = await onCreate(trimmed);
      if (tag) onChange([...selectedIds, tag.id]);
      setName("");
      setCreating(false);
    };

    return (
      <View style={styles.box}>
        <View style={styles.chips}>
          {tags.map((tag) => {
            const active = selectedIds.includes(tag.id);
            return (
              <Pressable
                key={tag.id}
                onPress={() => toggle(tag.id)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={`标签 ${tag.name}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {tag.name}
                </Text>
              </Pressable>
            );
          })}
          {onCreate ? (
            <Pressable
              style={[styles.chip, styles.chipAdd]}
              onPress={() => setCreating((v) => !v)}
              accessibilityLabel="新建标签"
            >
              <Text style={styles.chipText}>＋</Text>
            </Pressable>
          ) : null}
        </View>
        {creating ? (
          <View style={styles.createRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="新标签名"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={() => void submit()}
              autoFocus
            />
            <Pressable style={styles.createBtn} onPress={() => void submit()}>
              <Text style={styles.createBtnText}>创建</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipAdd: { borderStyle: "dashed" as never },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: "#FFFFFF", fontWeight: fontWeight.medium as never },
  createRow: { flexDirection: "row", gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    color: colors.text,
    fontSize: 14,
  },
  createBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  createBtnText: { color: "#FFFFFF", fontSize: 14 },
});

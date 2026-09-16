/**
 * Phase 5 contracts: mood entry composer + share poster commands.
 * Pure types — both platforms consume them (spec: ui-contracts
 * "Phase 5 契约常量与类型").
 */

/**
 * Mood tiers stored on MoodEntry.mood. Semantic keys (NOT display
 * strings) so Phase 6 i18n/theming can re-skin them; v1 UI maps them
 * to a fixed emoji set (love 😍 / ok 🙂 / meh 😐 / bored 😴 / sad 😢).
 */
export type MoodKind = "love" | "ok" | "meh" | "bored" | "sad";

export const MOOD_KINDS: readonly MoodKind[] = ["love", "ok", "meh", "bored", "sad"];

/** Fixed v1 emoji mapping for each mood tier. */
export const MOOD_EMOJI: Readonly<Record<MoodKind, string>> = {
  love: "😍",
  ok: "🙂",
  meh: "😐",
  bored: "😴",
  sad: "😢",
};

/** mood plugin: open the mood composer overlay for a record. */
export type MoodAddCommand = (recordId: string) => void;

/** share plugin: generate + export a share poster for a record. */
export type SharePosterCommand = (recordId: string) => Promise<ShareResult>;

export type ShareResult =
  | { readonly status: "shared" }
  | { readonly status: "downloaded"; readonly path?: string }
  | { readonly status: "cancelled" }
  | { readonly status: "error"; readonly message: string };

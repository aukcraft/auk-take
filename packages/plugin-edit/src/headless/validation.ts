/**
 * Editor draft validation: pure functions, fully matrix-testable in
 * plain Node (spec: plugin-edit "字段校验"). Draft fields are strings
 * because they mirror form inputs; parsing happens only after
 * validation succeeds.
 */
import type { MovieRecord } from "@auktake/core";

export type MediaType = "movie" | "episode";

/** Form-shaped draft (all free-text inputs). */
export interface EditorDraft {
  readonly title: string;
  readonly originalTitle: string;
  readonly mediaType: MediaType;
  readonly seasonNumber: string;
  readonly episodeNumber: string;
  /** "YYYY-MM-DD". */
  readonly watchedAt: string;
  /** "" or a number in text form, 0.5 steps, 0–10. 0/"" = unrated. */
  readonly rating: string;
  readonly review: string;
  /** Phase 3: selected tag ids (validated against existing tags at save). */
  readonly tagIds: readonly string[];
}

/** Per-field error messages; empty object = valid. */
export type FieldErrors = Partial<Record<keyof EditorDraft, string>>;

/** The parsed, validated payload handed to the records writer. */
export interface ValidatedDraft {
  readonly title: string;
  readonly originalTitle: string;
  readonly mediaType: MediaType;
  readonly seasonNumber?: number;
  readonly episodeNumber?: number;
  readonly watchedAt: string;
  readonly rating: number;
  readonly review: string;
  readonly tagIds: readonly string[];
}

export function emptyDraft(defaultWatchedAt: string): EditorDraft {
  return {
    title: "",
    originalTitle: "",
    mediaType: "movie",
    seasonNumber: "",
    episodeNumber: "",
    watchedAt: defaultWatchedAt,
    rating: "",
    review: "",
    tagIds: [],
  };
}

export function draftFromRecord(record: MovieRecord): EditorDraft {
  return {
    title: record.tmdb.title,
    originalTitle: record.tmdb.originalTitle,
    mediaType: record.tmdb.mediaType,
    seasonNumber: record.tmdb.seasonNumber === undefined ? "" : String(record.tmdb.seasonNumber),
    episodeNumber: record.tmdb.episodeNumber === undefined ? "" : String(record.tmdb.episodeNumber),
    watchedAt: record.user.watchedAt,
    rating: record.user.rating === 0 ? "" : String(record.user.rating),
    review: record.user.review,
    tagIds: [...record.user.tags],
  };
}

/** "YYYY-MM-DD" that is a REAL calendar day (rejects 2025-02-30 etc). */
export function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(y, m - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
}

export function validateDraft(draft: EditorDraft): FieldErrors {
  const errors: FieldErrors = {};

  if (draft.title.trim().length === 0) {
    errors.title = "标题必填";
  }

  if (!isRealCalendarDate(draft.watchedAt.trim())) {
    errors.watchedAt = "需要真实存在的日期（YYYY-MM-DD）";
  }

  const ratingText = draft.rating.trim();
  if (ratingText.length === 0) {
    // empty = unrated (rating 0)
  } else if (!/^\d+(\.\d+?)?$/.test(ratingText)) {
    errors.rating = "评分为 0–10、步进 0.5 的数字";
  } else {
    const value = Number(ratingText);
    if (!(value >= 0 && value <= 10)) {
      errors.rating = "评分需在 0–10 之间";
    } else if (Math.round(value * 2) !== value * 2) {
      errors.rating = "评分需为 0.5 的整数倍";
    }
  }

  if (draft.mediaType === "episode") {
    const season = Number(draft.seasonNumber.trim());
    const episode = Number(draft.episodeNumber.trim());
    if (!/^\d+$/.test(draft.seasonNumber.trim()) || season < 1) {
      errors.seasonNumber = "剧集需填写季号（≥1）";
    }
    if (!/^\d+$/.test(draft.episodeNumber.trim()) || episode < 1) {
      errors.episodeNumber = "剧集需填写集号（≥1）";
    }
  } else {
    if (draft.seasonNumber.trim().length > 0 || draft.episodeNumber.trim().length > 0) {
      errors.seasonNumber = "电影不能携带季/集号";
    }
  }

  return errors;
}

/** Parse a draft known to be valid (validateDraft returned {}). */
export function parseDraft(draft: EditorDraft): ValidatedDraft {
  const rating = draft.rating.trim().length === 0 ? 0 : Number(draft.rating.trim());
  const base: ValidatedDraft = {
    tagIds: draft.tagIds,
    title: draft.title.trim(),
    originalTitle: draft.originalTitle.trim().length === 0
      ? draft.title.trim()
      : draft.originalTitle.trim(),
    mediaType: draft.mediaType,
    watchedAt: draft.watchedAt.trim(),
    rating,
    review: draft.review,
  };
  if (draft.mediaType === "episode") {
    return {
      ...base,
      seasonNumber: Number(draft.seasonNumber.trim()),
      episodeNumber: Number(draft.episodeNumber.trim()),
    };
  }
  return base;
}

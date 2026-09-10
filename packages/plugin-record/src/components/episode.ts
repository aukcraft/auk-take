/** Local badge helper (mirrors ui-contracts consumers; keeps record plugin self-contained). */
import type { MovieRecord } from "@auktake/core";

export function episodeBadge(record: MovieRecord): string {
  if (record.tmdb.mediaType !== "episode") return "";
  const s = String(record.tmdb.seasonNumber ?? 0).padStart(2, "0");
  const e = String(record.tmdb.episodeNumber ?? 0).padStart(2, "0");
  return `S${s}E${e}`;
}

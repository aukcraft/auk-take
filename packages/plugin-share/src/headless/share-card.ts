/**
 * Share poster SVG generation (headless, design D3): pure function —
 * a fixed 1080×1350 template with the poster image (dataURL) or the
 * deterministic palette placeholder, title, rating, watch date, review
 * excerpt and episode badge. Assertable in plain Node.
 */
import type { MovieRecord } from "@auktake/core";
import { POSTER_PALETTE, colorHash } from "@auktake/ui-contracts";

export const SHARE_CARD = { width: 1080, height: 1350 } as const;

/** Max review excerpt length on the card (chars). */
const REVIEW_EXCERPT = 120;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ratingText(rating: number): string {
  return rating > 0 ? `★ ${rating.toFixed(1)}` : "未评分";
}

function episodeBadge(record: MovieRecord): string {
  if (record.tmdb.mediaType !== "episode") return "";
  const s = String(record.tmdb.seasonNumber ?? 1).padStart(2, "0");
  const e = String(record.tmdb.episodeNumber ?? 1).padStart(2, "0");
  return `S${s}E${e}`;
}

function excerpt(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > REVIEW_EXCERPT ? `${clean.slice(0, REVIEW_EXCERPT)}…` : clean;
}

/**
 * Render the share card SVG. `posterDataUrl` is a base64 data URL of
 * the cached poster (local file -> data URL conversion happens in the
 * export port); when absent the deterministic palette placeholder is
 * used — sharing NEVER fails over a missing image (spec scenario
 * "无海报回退色卡").
 */
export function renderShareCard(record: MovieRecord, posterDataUrl?: string): string {
  const { width: W, height: H } = SHARE_CARD;
  const slot = POSTER_PALETTE[colorHash(record.tmdb.title)]!;
  const badge = episodeBadge(record);
  const title = escapeXml(record.tmdb.title + (badge ? ` ${badge}` : ""));
  const posterH = 810;

  const posterLayer = posterDataUrl
    ? `<image href="${posterDataUrl}" x="0" y="0" width="${W}" height="${posterH}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="0" y="0" width="${W}" height="${posterH}" fill="${slot.bg}"/>` +
      `<text x="${W / 2}" y="${posterH / 2}" text-anchor="middle" font-size="72" font-weight="600" fill="${slot.fg}" font-family="sans-serif">${escapeXml(record.tmdb.title.slice(0, 12))}</text>`;

  const review = excerpt(record.user.review);
  const reviewLayer = review
    ? `<text x="72" y="${posterH + 250}" font-size="30" fill="#9A9AA6" font-family="sans-serif">${escapeXml(review)}</text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#101014"/>` +
    posterLayer +
    `<text x="72" y="${posterH + 90}" font-size="52" font-weight="700" fill="#EDEDF2" font-family="sans-serif">${title}</text>` +
    `<text x="72" y="${posterH + 160}" font-size="34" fill="#7C6CF0" font-family="sans-serif">${escapeXml(ratingText(record.user.rating))} · ${escapeXml(record.user.watchedAt)}</text>` +
    reviewLayer +
    `<text x="72" y="${H - 56}" font-size="26" fill="#9A9AA6" font-family="sans-serif">AukTake 观影记录</text>` +
    `</svg>`
  );
}

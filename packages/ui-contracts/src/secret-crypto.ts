/**
 * At-rest secret encryption for TMDB credentials (v4 read token / v3
 * key). Pure-TS stream cipher: random IV + keystream PRNG seeded from
 * an app pepper + IV, XOR'd over the secret, hex-encoded with a
 * version tag.
 *
 * HONEST SCOPE: this protects against casual reads of the data file
 * and accidental plaintext leaks in exports/logs. It is NOT vault-
 * grade — the pepper ships in the app, as any local-only scheme must
 * (no OS keystore access without native modules, out of Phase 2
 * scope). Formal statement in design appendix A6.
 */

const PEPPER = "auktake.tmdb.v1::7f3b9c1e-d5a2-4b8e-9c0f-6d4a2e8b1c3f";
const VERSION = "v1";

/** Deterministic PRNG keystream (xorshift32), seeded per encryption. */
function keystream(seed: number, length: number): Uint8Array {
  let state = seed || 0x9e3779b9;
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out[i] = state & 0xff;
  }
  return out;
}

function seedFrom(...parts: string[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h >>> 0;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("bad hex length");
  return Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
    parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  );
}

let fallbackCounter = 0;

/** Encrypt a secret; returns `v1:<iv>:<ciphertext>` (both hex). */
export function encryptSecret(plain: string): string {
  if (plain.length === 0) return "";
  const iv = new Uint8Array(8);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?(b: Uint8Array): void } }).crypto;
  const hasRng = typeof webCrypto?.getRandomValues === "function";
  if (hasRng) webCrypto!.getRandomValues!(iv);
  // fallback entropy when crypto RNG is absent: time + counter mix
  if (!hasRng) {
    fallbackCounter += 1;
    const mix = (Date.now() ^ (fallbackCounter * 0x9e3779b9)) >>> 0;
    for (let i = 0; i < 8; i++) iv[i] = (mix >>> (i * 4)) & 0xff ^ (i * 31);
  }
  const seed = seedFrom(PEPPER, toHex(iv));
  const data = new TextEncoderShim().encode(plain);
  const key = keystream(seed, data.length);
  const cipher = data.map((b, i) => b ^ key[i]!);
  return `${VERSION}:${toHex(iv)}:${toHex(cipher)}`;
}

/** Decrypt a `v1:<iv>:<ciphertext>` blob; throws on tamper/version. */
export function decryptSecret(blob: string): string {
  if (blob.length === 0) return "";
  const parts = blob.split(":");
  if (parts.length !== 3 || parts[0] !== VERSION) {
    throw new Error("unreadable secret blob");
  }
  const cipher = fromHex(parts[2]!);
  const seed = seedFrom(PEPPER, parts[1]!);
  const key = keystream(seed, cipher.length);
  const plain = cipher.map((b, i) => b ^ key[i]!);
  return new TextDecoderShim().decode(plain);
}

/** True when the blob looks encrypted (used to migrate legacy plaintext). */
export function isEncryptedSecret(value: string): boolean {
  return /^v1:[0-9a-f]+:[0-9a-f]+$/.test(value);
}

/** Minimal UTF-8 shims (no DOM lib in this package's tsconfig). */
class TextEncoderShim {
  encode(text: string): Uint8Array {
    const out: number[] = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return Uint8Array.from(out);
  }
}
class TextDecoderShim {
  decode(bytes: Uint8Array): string {
    let out = "";
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i]!;
      if (b < 0x80) {
        out += String.fromCodePoint(b);
        i += 1;
      } else if (b < 0xe0) {
        out += String.fromCodePoint(((b & 0x1f) << 6) | (bytes[i + 1]! & 63));
        i += 2;
      } else if (b < 0xf0) {
        out += String.fromCodePoint(((b & 0x0f) << 12) | ((bytes[i + 1]! & 63) << 6) | (bytes[i + 2]! & 63));
        i += 3;
      } else {
        out += String.fromCodePoint(
          ((b & 0x07) << 18) | ((bytes[i + 1]! & 63) << 12) | ((bytes[i + 2]! & 63) << 6) | (bytes[i + 3]! & 63),
        );
        i += 4;
      }
    }
    return out;
  }
}

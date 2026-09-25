// Building a safe download file name and Content-Disposition header for the
// session export (Group 5, E5). Two separate concerns: `safeFileName` cleans
// a session NAME for use inside a file name; `contentDisposition` encodes a
// full file name (already safe) into the header itself.

// Path separators, reserved Windows characters, and quotes (which would
// otherwise break out of the quoted filename="..." token). Control
// characters (including CR/LF, which could inject extra header lines) are
// stripped separately below.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g
const FORBIDDEN_CHARS = /[\\/:*?"<>|]/g
// security LOW: bidi overrides and zero-width characters can visually spoof
// a file name (e.g. a right-to-left override making "exe.jpg" READ as
// "gpj.exe" while the bytes stay whatever an attacker chose) - stripped
// alongside ordinary control characters. Covers explicit formatting
// characters (U+200B-U+200F, U+202A-U+202E), word joiner/invisible math
// operators (U+2060-U+2064), isolates (U+2066-U+2069) and the BOM (U+FEFF).
const BIDI_ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g

/** A session's `name` -> safe to embed in a file name: control characters,
 *  bidi/zero-width characters, quotes and path/reserved characters stripped,
 *  trimmed, capped at 150 characters, and never empty. */
export function safeFileName(name) {
  const cleaned = String(name ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(BIDI_ZERO_WIDTH, '')
    .replace(FORBIDDEN_CHARS, '')
    .trim()
    .slice(0, 150)
    .trim()
  return cleaned || 'session'
}

// RFC 8187 (referenced by RFC 6266's ext-value): an attr-char is any
// pct-encoded octet or one of ALPHA / DIGIT / "!" / "#" / "$" / "&" / "+" /
// "-" / "." / "^" / "_" / "`" / "|" / "~" - notably NOT "'", "(", ")" or "*",
// even though encodeURIComponent leaves all four of those (plus "!") alone.
// A strict RFC 8187 parser could reject - or worse, a lax one could
// misinterpret - an un-encoded "*" or "'" inside the value, so percent-encode
// exactly the gap between what encodeURIComponent does and what the RFC
// allows unescaped.
const encodeExtValue = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/** A `Content-Disposition: attachment` header for `fileName` (already run
 *  through safeFileName / already ASCII-safe date suffix): an ASCII fallback
 *  for older clients plus the RFC 5987/8187 filename* form so accented or
 *  non-Latin session names still download with their real name in modern
 *  browsers. `decodeURIComponent` on the receiving end (client/src/lib/
 *  download.js) decodes every percent-encoded octet the same way regardless
 *  of which characters were escaped, so this stays a lossless round trip. */
export function contentDisposition(fileName) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'")
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeExtValue(fileName)}`
}

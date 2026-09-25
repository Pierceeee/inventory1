// Saving a Blob the browser downloaded, and working out what to call it.

/** Triggers a browser download of `blob` as `fileName` via a throwaway
 *  object URL and a hidden anchor click - the standard no-navigation
 *  download trick (client/src/api/exports.js uses the same one). */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const pad2 = (n) => String(n).padStart(2, '0')
const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

// Mirrors server/src/lib/fileName.js's safeFileName - kept in sync by hand
// (the two run in different runtimes). Only used as a fallback name, when a
// response has no parseable Content-Disposition header.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g
const FORBIDDEN_CHARS = /[\\/:*?"<>|]/g
// security LOW - same reasoning as the server: bidi overrides / zero-width
// characters can visually spoof a file name, so strip them here too.
const BIDI_ZERO_WIDTH = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g

function safeName(name) {
  const cleaned = String(name ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(BIDI_ZERO_WIDTH, '')
    .replace(FORBIDDEN_CHARS, '')
    .trim()
    .slice(0, 150)
    .trim()
  return cleaned || 'session'
}

/** `<name> - YYYY-MM-DD.xlsx` - the same shape the server names its export
 *  (server/src/services/sessionExport.js), for the fallback path above. */
export function exportFileName(name, date = new Date()) {
  return `${safeName(name)} - ${isoDate(date)}.xlsx`
}

/**
 * Pulls a file name out of a `Content-Disposition` header, preferring the
 * RFC 5987 `filename*=UTF-8''...` form (exact, handles non-ASCII) over the
 * plain ASCII `filename="..."` fallback the server also sends.
 */
export function fileNameFromContentDisposition(header) {
  if (!header) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      // Fall through to the plain form below.
    }
  }
  const plain = /filename="([^"]*)"/i.exec(header)
  return plain ? plain[1] : null
}

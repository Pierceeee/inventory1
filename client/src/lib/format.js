const pad = (n) => String(n).padStart(2, '0')
const parse = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" in the viewer's local time, for datetime-local. */
export function toLocalInput(iso) {
  const d = parse(iso)
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" in local time -> UTC ISO. A bare datetime-local value is
 *  parsed as local time by the platform, which is exactly what we want. */
export function fromLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
})
const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric', minute: '2-digit', hour12: true,
})

export function formatDate(iso) {
  const d = parse(iso)
  return d ? DATE_FMT.format(d) : ''
}

export function formatDateTime(iso) {
  const d = parse(iso)
  return d ? `${DATE_FMT.format(d)}, ${TIME_FMT.format(d).toLowerCase()}` : ''
}

/** Largest sensible unit: "today", "3 days", "6 months", "2 years". */
export function formatDuration(fromIso, toIso) {
  const from = parse(fromIso)
  const to = toIso ? parse(toIso) : new Date()
  if (!from || !to) return ''

  const days = Math.floor((to - from) / 86_400_000)
  if (days <= 0) return 'today'
  if (days < 30) return days === 1 ? '1 day' : `${days} days`

  const months = Math.floor(days / 30.44)
  if (months < 12) return months === 1 ? '1 month' : `${months} months`

  const years = Math.floor(days / 365.25)
  return years === 1 ? '1 year' : `${years} years`
}

/** An imported column's key as a readable label: camelCase and snake_case
 *  keys ("serialNumber", "assigned_to") read as words ("Serial number",
 *  "Assigned to"). A header written for people ("NEW ASSET TAG",
 *  "Notes/ Anydesk") is shown exactly as the spreadsheet had it. */
export function columnLabel(name) {
  const text = String(name ?? '')
  const camel = /^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(text)
  const snake = /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(text)
  if (!camel && !snake) return text
  const words = text.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Columns holding codes (serials, tags, IMEIs) are set in monospace. */
export const isCodeColumn = (name) => /serial|code|tag|imei|^s\/?n$/i.test(String(name ?? ''))

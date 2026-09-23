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

/** UTC ISO -> "YYYY-MM-DD" in local time, for <input type="date">. */
export function toDateInput(iso) {
  const d = parse(iso)
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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

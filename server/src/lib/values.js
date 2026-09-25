export const DEVICE_TYPES = ['laptop', 'mobile']
export const DEVICE_STATUSES = ['available', 'repair', 'retired']
export const OS_VALUES = ['macos', 'windows', 'ios', 'android']
export const RETURN_REASONS = ['resignation', 'swap', 'repair', 'lost', 'other']
export const CONDITIONS = ['good', 'fair', 'damaged']
export const ROLES = ['admin', 'head', 'scanner']
// security MEDIUM (Group 5 review): an unbounded session (10,000 rows per
// import, but unlimited imports) makes a single session's export an
// unbounded amount of synchronous work on the event loop. Enforced in the
// import commit transaction (services/sessionItems.js), under the session's
// row lock, so two concurrent imports cannot both squeak in under the cap.
export const SESSION_ITEM_CAP = 50_000
// Custody (devices, employees, assignments, import, reports) is Admin + Head;
// scanners get none of it (D2).
export const CUSTODY_ROLES = ['admin', 'head']
export const ACCESSORIES_FOR = {
  laptop: ['charger', 'case', 'box'],
  mobile: ['charger', 'case', 'sim', 'box'],
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A malformed id is simply a record that does not exist - never a 500 from
 *  Postgres rejecting the cast. */
export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value)

/** Accessories are known tokens so "charger missing" is reportable. Anything
 *  else is dropped rather than stored. Order and duplicates are normalised. */
export function cleanAccessories(list, type) {
  const allowed = ACCESSORIES_FOR[type] ?? []
  if (!Array.isArray(list)) return []
  return allowed.filter((token) => list.includes(token))
}

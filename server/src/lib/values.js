export const DEVICE_TYPES = ['laptop', 'mobile']
export const DEVICE_STATUSES = ['available', 'repair', 'retired']
export const OS_VALUES = ['macos', 'windows', 'ios', 'android']
export const EMPLOYEE_STATUSES = ['active', 'resigned']
export const RETURN_REASONS = ['resignation', 'swap', 'repair', 'lost', 'other']
export const CONDITIONS = ['good', 'fair', 'damaged']
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

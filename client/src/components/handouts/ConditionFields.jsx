import Icon from '../ui/Icon.jsx'

export const ACCESSORIES_FOR = {
  laptop: ['charger', 'case', 'box'],
  mobile: ['charger', 'case', 'sim', 'box'],
}

export const ACCESSORY_LABELS = {
  charger: 'Charger', case: 'Case', sim: 'SIM card', box: 'Original box',
}

export const CONDITIONS = [
  ['good', 'Good', 'Working, no visible damage'],
  ['fair', 'Fair', 'Working, cosmetic wear'],
  ['damaged', 'Damaged', 'Needs repair or parts missing'],
]

export const CONDITION_RANK = { good: 0, fair: 1, damaged: 2 }

export const CONDITION_STYLES = {
  good: 'bg-ok-50 text-ok-700',
  fair: 'bg-warn-50 text-warn-700',
  damaged: 'bg-bad-50 text-bad-700',
}

export function ConditionBadge({ condition }) {
  if (!condition) return null
  const label = CONDITIONS.find(([v]) => v === condition)?.[1] ?? condition
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_STYLES[condition]}`}>
      {label}
    </span>
  )
}

/**
 * Condition is a radio group, not a dropdown: three options that people must
 * weigh are worth showing all at once, and the descriptions make "fair" mean
 * the same thing to everyone recording a handout.
 */
export function ConditionPicker({ id, value, onChange, error, legend }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">
        {legend}<span className="ml-0.5 text-bad-700" aria-hidden="true">*</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {CONDITIONS.map(([option, label, hint]) => (
          <label
            key={option}
            className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2 transition-colors ${
              value === option
                ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                : 'border-slate-300 hover:bg-slate-50'
            }`}>
            <span className="flex items-center gap-2">
              <input
                type="radio" name={id} value={option} checked={value === option}
                onChange={() => onChange(option)}
                className="text-brand-600 focus:ring-brand-600"
              />
              <span className="text-sm font-medium text-slate-900">{label}</span>
            </span>
            <span className="pl-6 text-xs text-slate-500">{hint}</span>
          </label>
        ))}
      </div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-bad-700">{error}</p>}
    </fieldset>
  )
}

/**
 * Tokens, not free text, so "charger missing" is reportable rather than buried
 * in a notes field nobody greps. `expected` marks what went out with the device,
 * which is what makes an unticked box meaningful on return.
 */
export function AccessoryPicker({ type, value, onChange, legend, expected }) {
  const options = ACCESSORIES_FOR[type] ?? []
  if (options.length === 0) return null

  const toggle = (token) =>
    onChange(value.includes(token) ? value.filter((a) => a !== token) : [...value, token])

  const missing = expected ? expected.filter((a) => !value.includes(a)) : []

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((token) => {
          const checked = value.includes(token)
          const wasIssued = expected?.includes(token)
          return (
            <label
              key={token}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                checked ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(token)}
                     className="rounded border-slate-300 text-brand-600 focus:ring-brand-600" />
              {ACCESSORY_LABELS[token]}
              {wasIssued && !checked && <Icon name="warning" size={13} className="text-warn-700" />}
            </label>
          )
        })}
      </div>
      {missing.length > 0 && (
        <p className="mt-1.5 text-xs font-medium text-warn-700">
          Not coming back: {missing.map((a) => ACCESSORY_LABELS[a]).join(', ')}.
        </p>
      )}
    </fieldset>
  )
}

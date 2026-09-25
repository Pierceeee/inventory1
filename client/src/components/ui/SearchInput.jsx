import { useEffect, useState } from 'react'
import { inputClass } from './Field.jsx'
import Icon from './Icon.jsx'

/** Debounced so typing does not fire a request per keystroke, while the value
 *  shown in the box updates immediately. */
export default function SearchInput({ value, onChange, placeholder = 'Search…', delay = 250 }) {
  const [draft, setDraft] = useState(value ?? '')

  useEffect(() => { setDraft(value ?? '') }, [value])

  useEffect(() => {
    if (draft === (value ?? '')) return
    const timer = setTimeout(() => onChange(draft), delay)
    return () => clearTimeout(timer)
  }, [draft, delay]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full max-w-xs">
      <Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        className={`${inputClass} pl-9`}
      />
    </div>
  )
}

/** A segmented control: one hairline strip, the chosen segment in ink. */
export default function FilterChips({ label, options, value, onChange }) {
  return (
    <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-md bg-white p-0.5 shadow-panel ring-1 ring-inset ring-slate-300"
         role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value ?? option.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`h-10 rounded-[5px] px-3 text-sm font-semibold transition-colors duration-150 sm:h-8 ${
              selected ? 'bg-ink-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-ink-900'
            }`}>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

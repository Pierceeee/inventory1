export const inputClass =
  'block w-full rounded-md border-0 bg-white px-3 py-2 text-[15px] text-ink-900 shadow-panel ring-1 ring-inset ring-slate-300 ' +
  'placeholder:text-slate-400 hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

/** Label + control + error, with the error wired to aria-describedby. */
export default function Field({ id, label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-900">
        {label}
        {required && <span className="ml-0.5 text-bad-600" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-[13px] font-medium text-bad-700">{error}</p>}
    </div>
  )
}

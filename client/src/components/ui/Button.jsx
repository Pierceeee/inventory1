// Primary actions are ink, like the sign panel; secondary actions are a
// hairline outline; destructive ones are red and never the default.
const VARIANTS = {
  primary: 'bg-ink-900 text-white shadow-panel hover:bg-ink-800 active:bg-ink-950',
  secondary: 'bg-white text-ink-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:ring-slate-400',
  danger: 'bg-bad-600 text-white shadow-panel hover:bg-bad-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-ink-900',
}

export default function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 sm:h-9 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

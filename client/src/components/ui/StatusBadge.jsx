const STYLES = {
  available: ['Available', 'bg-ok-50 text-ok-700'],
  issued:    ['Issued',    'bg-brand-50 text-brand-700'],
  repair:    ['In repair', 'bg-warn-50 text-warn-700'],
  retired:   ['Retired',   'bg-slate-100 text-slate-600'],
  active:    ['Active',    'bg-ok-50 text-ok-700'],
  resigned:  ['Resigned',  'bg-slate-100 text-slate-600'],
}

export default function StatusBadge({ status }) {
  const [label, classes] = STYLES[status] ?? [status, 'bg-slate-100 text-slate-600']
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}

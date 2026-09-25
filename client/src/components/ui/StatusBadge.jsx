// One state scale for the whole app: every status is declared here once
// and drawn the same way everywhere - a dot and a word, never colour alone.
const TONES = {
  ok:      'bg-ok-50 text-ok-700 ring-ok-200',
  info:    'bg-brand-50 text-brand-700 ring-brand-200',
  warn:    'bg-warn-50 text-warn-700 ring-warn-200',
  bad:     'bg-bad-50 text-bad-700 ring-bad-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}
const DOTS = { ok: 'bg-ok-600', info: 'bg-brand-600', warn: 'bg-warn-600', bad: 'bg-bad-600', neutral: 'bg-slate-400' }

const STATES = {
  available: ['Available', 'ok'],
  issued:    ['Issued',    'info'],
  repair:    ['In repair', 'warn'],
  retired:   ['Retired',   'neutral'],
  active:    ['Active',    'ok'],
  resigned:  ['Resigned',  'neutral'],
  disabled:  ['Disabled',  'bad'],
  completed: ['Completed', 'info'],
  archived:  ['Archived',  'neutral'],
  scanned:   ['Scanned',   'ok'],
  pending:   ['Pending',   'warn'],
}

export default function StatusBadge({ status }) {
  const [label, tone] = STATES[status] ?? [status, 'neutral']
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} />
      {label}
    </span>
  )
}

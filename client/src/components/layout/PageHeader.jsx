import { Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'

/** "Back to the list" above a page title, with a drawn arrow. */
export function BackLink({ to, children }) {
  return (
    <Link to={to} className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
      <Icon name="arrowLeft" size={15} />
      {children}
    </Link>
  )
}

export default function PageHeader({ title, subtitle, actions, back }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {back}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

import { Link, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { locate } from './navigation.js'
import AccountMenu from './AccountMenu.jsx'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

/**
 * The route strip: where you are (zone key, zone › page › sub-page) and the
 * Find directory, on every signed-in page. On phones it also carries the
 * menu button, since the sign panel is off-canvas there.
 */
export default function TopBar({ onMenu, onFind }) {
  const { pathname } = useLocation()
  const here = locate(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 print:hidden sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="-ml-2 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
        <Icon name="menu" size={22} title="Open menu" />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        {here ? (
          <ol className="flex min-w-0 items-center gap-2 text-sm">
            <li className="flex shrink-0 items-center gap-2 font-medium text-slate-500">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[2px] ${here.zone.key}`} />
              <span className="hidden sm:inline">{here.zone.label}</span>
            </li>
            <li aria-hidden="true" className="hidden text-slate-300 sm:block"><Icon name="chevronRight" size={14} /></li>
            <li className="min-w-0 truncate">
              {here.sub ? (
                <Link to={here.page.to} className="font-medium text-slate-600 hover:text-ink-900 hover:underline">
                  {here.page.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-semibold text-ink-900">{here.page.label}</span>
              )}
            </li>
            {here.sub && (
              <>
                <li aria-hidden="true" className="text-slate-300"><Icon name="chevronRight" size={14} /></li>
                <li className="min-w-0 truncate">
                  <span aria-current="page" className="font-semibold text-ink-900">{here.sub}</span>
                </li>
              </>
            )}
          </ol>
        ) : (
          <p className="text-sm font-semibold text-ink-900">Adspark IT Inventory</p>
        )}
      </nav>

      <button
        type="button"
        onClick={onFind}
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 sm:w-72 md:w-80">
        <Icon name="search" size={17} className="text-slate-400" />
        <span className="hidden sm:inline">Find a device, person or session</span>
        <span className="sr-only sm:hidden">Find</span>
        <span className="ml-auto hidden items-center gap-1 sm:flex" aria-hidden="true">
          <kbd className="kbd">{isMac ? '⌘' : 'Ctrl'}</kbd><kbd className="kbd">K</kbd>
        </span>
      </button>

      <AccountMenu />
    </header>
  )
}

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { useDialogFocus } from '../ui/useDialogFocus.js'
import { listDevices } from '../../api/devices.js'
import { listEmployees } from '../../api/employees.js'
import { listSessions } from '../../api/inventorySessions.js'
import { useSession } from '../../hooks/useSession.jsx'
import { CUSTODY_ROLES } from '../../lib/roles.js'
import { zonesFor } from './navigation.js'

const PER_GROUP = 5
const DEVICE_STATUS = { available: 'Available', repair: 'In repair', retired: 'Retired' }

const contains = (text, q) => String(text ?? '').toLowerCase().includes(q)

/**
 * The Find directory (Ctrl K): one box that reaches any page, device,
 * person or session the signed-in role can see. Devices and people come
 * from the same searches their own pages use; sessions are filtered here
 * (a few dozen at most). A combobox over a listbox, so arrow keys move the
 * highlight, Enter goes, Escape closes and focus returns where it was.
 */
export default function FindDialog({ open, onClose }) {
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()
  const navigate = useNavigate()
  const { role } = useSession()
  const custody = CUSTODY_ROLES.includes(role)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ devices: [], employees: [] })
  const [sessions, setSessions] = useState([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(0)

  useDialogFocus({ open, onClose, panelRef })

  // A fresh directory every time it opens.
  useEffect(() => {
    if (!open) return
    setQuery(''); setResults({ devices: [], employees: [] }); setActive(0); setFailed(false)
    let live = true
    listSessions().then(({ data }) => { if (live) setSessions(data ?? []) }).catch(() => {})
    return () => { live = false }
  }, [open])

  const q = query.trim().toLowerCase()

  // Devices and people, debounced; only for roles that may see them.
  useEffect(() => {
    if (!open || !custody || q.length < 2) { setResults({ devices: [], employees: [] }); setSearching(false); return }
    let live = true
    setSearching(true)
    const timer = setTimeout(() => {
      Promise.all([listDevices({ q }), listEmployees({ q })])
        .then(([devices, employees]) => {
          if (!live) return
          setResults({ devices: devices.data ?? [], employees: employees.data ?? [] })
          setFailed(false)
        })
        .catch(() => { if (live) setFailed(true) })
        .finally(() => { if (live) setSearching(false) })
    }, 180)
    return () => { live = false; clearTimeout(timer) }
  }, [open, custody, q])

  const groups = useMemo(() => {
    const pages = zonesFor(role).flatMap((zone) =>
      zone.links.map((link) => ({
        id: `page:${link.to}`, to: link.to, icon: link.icon, title: link.label, detail: zone.label,
      })))
    const list = [
      { label: 'Pages', items: (q ? pages.filter((p) => contains(p.title, q)) : pages).slice(0, q ? PER_GROUP : 12) },
    ]
    if (!q) return list

    list.push({
      label: 'Sessions',
      items: sessions
        .filter((s) => contains(s.name, q) || contains(s.department_name, q))
        .slice(0, PER_GROUP)
        .map((s) => ({
          id: `session:${s.id}`, to: `/sessions/${s.id}`, icon: 'sessions', title: s.name,
          detail: [s.department_name, s.effective_status && s.effective_status[0].toUpperCase() + s.effective_status.slice(1)]
            .filter(Boolean).join(' · '),
        })),
    })
    if (custody) {
      list.push({
        label: 'Devices',
        items: results.devices.slice(0, PER_GROUP).map((d) => ({
          id: `device:${d.id}`, to: `/devices/${d.id}`, icon: d.type === 'mobile' ? 'mobile' : 'devices',
          title: d.asset_tag, code: true,
          detail: [d.model, d.current_holder ? `with ${d.current_holder.full_name}` : DEVICE_STATUS[d.status]]
            .filter(Boolean).join(' · '),
        })),
      })
      list.push({
        label: 'People',
        items: results.employees.slice(0, PER_GROUP).map((e) => ({
          id: `employee:${e.id}`, to: `/employees/${e.id}`, icon: 'employees', title: e.full_name,
          detail: [e.department, e.email].filter(Boolean).join(' · '),
        })),
      })
    }
    return list.filter((g) => g.items.length > 0)
  }, [role, custody, q, sessions, results])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  useEffect(() => { setActive(0) }, [q])
  const current = flat[Math.min(active, flat.length - 1)]

  function go(item) {
    if (!item) return
    onClose()
    navigate(item.to)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (Math.min(i, flat.length - 1) + step + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(current)
    }
  }

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!current) return
    document.getElementById(`${listId}-${current.id}`)?.scrollIntoView({ block: 'nearest' })
  }, [current, listId])

  if (!open) return null

  const optionId = (item) => `${listId}-${item.id}`
  const hint = !custody
    ? 'Type to find a page or session.'
    : 'Type at least two letters to find devices, people and sessions.'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink-950/40 motion-safe:animate-scrim-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Find"
        tabIndex={-1}
        className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-overlay outline-none motion-safe:animate-overlay-in">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Icon name="search" size={20} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={current ? optionId(current) : undefined}
            aria-autocomplete="list"
            aria-label="Find a page, device, person or session"
            placeholder="Find a page, device, person or session…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="h-14 min-w-0 flex-1 border-0 bg-transparent text-base text-ink-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <div id={listId} role="listbox" aria-label="Results" className="flex-1 overflow-y-auto py-2">
          {groups.map((group) => (
            <div key={group.label} role="group" aria-label={group.label} className="pb-1">
              <p className="caption px-4 pb-1 pt-2">{group.label}</p>
              {group.items.map((item) => {
                const selected = item === current
                return (
                  <div
                    key={item.id}
                    id={optionId(item)}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => setActive(flat.indexOf(item))}
                    onClick={() => go(item)}
                    className={`relative mx-2 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 ${
                      selected ? 'bg-brand-50' : ''}`}>
                    {selected && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-sm bg-brand-600" />}
                    <Icon name={item.icon} size={18} className={selected ? 'text-brand-700' : 'text-slate-400'} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${item.code ? 'font-mono text-[13px]' : ''} ${selected ? 'text-brand-800' : 'text-ink-900'}`}>
                        {item.title}
                      </p>
                      {item.detail && <p className="truncate text-xs text-slate-500">{item.detail}</p>}
                    </div>
                    {selected && <Icon name="enter" size={16} className="text-brand-700" />}
                  </div>
                )
              })}
            </div>
          ))}

          {q && flat.length === 0 && !searching && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {failed ? 'Search is unavailable right now. Try again in a moment.' : `Nothing matches “${query.trim()}”.`}
            </p>
          )}
          {searching && flat.length === 0 && (
            <p role="status" className="px-4 py-8 text-center text-sm text-slate-500">Searching…</p>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> move</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">Enter</kbd> open</span>
          <span className="ml-auto hidden sm:block">{q.length < 2 ? hint : `${flat.length} found`}</span>
        </div>
      </div>
    </div>
  )
}

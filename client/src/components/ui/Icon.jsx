/**
 * Inline SVG icon set, one 24px grid and one 1.6 stroke. No icon dependency:
 * the app needs a few dozen glyphs, and a package would cost more than it
 * saves. The sidebar pictograms (dashboard ... departments) are the
 * wayfinding signs for each page.
 *
 * Decorative by default (aria-hidden). Pass a `title` only when the icon is the
 * sole carrier of meaning - next to visible text it should stay hidden from
 * screen readers so the label is not read twice.
 */
const PATHS = {
  laptop: 'M3 5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25v9.5H3v-9.5ZM1.5 17.25h21v.5a2.25 2.25 0 0 1-2.25 2.25H3.75a2.25 2.25 0 0 1-2.25-2.25v-.5Z',
  mobile: 'M7.5 2.25h9A1.75 1.75 0 0 1 18.25 4v16A1.75 1.75 0 0 1 16.5 21.75h-9A1.75 1.75 0 0 1 5.75 20V4A1.75 1.75 0 0 1 7.5 2.25Zm2.25 16.5h4.5',
  check: 'M4.5 12.75l6 6 9-13.5',
  warning: 'M12 9v3.75m0 3.75h.008M10.34 3.94 1.95 18.5A1.9 1.9 0 0 0 3.6 21.4h16.8a1.9 1.9 0 0 0 1.65-2.9L13.66 3.94a1.9 1.9 0 0 0-3.32 0Z',
  info: 'M11.25 11.25h1.5v5.25m-.75-9h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  download: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
  close: 'M6 18 18 6M6 6l12 12',
  menu: 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5',
  chevronUp: 'm4.5 15.75 7.5-7.5 7.5 7.5',
  chevronDown: 'm19.5 8.25-7.5 7.5-7.5-7.5',
  arrowRight: 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
  arrowLeft: 'M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18',
  eye: 'M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  eyeOff: 'M3 3l18 18M10.58 10.58a3 3 0 0 0 4.24 4.24M9.88 5.09A9.77 9.77 0 0 1 12 4.5c6 0 9.75 7.5 9.75 7.5a17.6 17.6 0 0 1-3.24 4.32M6.5 6.64C4 8.36 2.25 12 2.25 12s2.02 4.02 5.61 6.02',
  pencil: 'M16.86 3.96a2.25 2.25 0 0 1 3.18 3.18L7.5 19.68l-4.5 1.32 1.32-4.5L16.86 3.96Z',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  eraser: 'M19.5 12.5 12 20H6.75L2.25 15.5a1.5 1.5 0 0 1 0-2.12l9-9a1.5 1.5 0 0 1 2.12 0l6 6a1.5 1.5 0 0 1 .13 2.12ZM8 20h12',
  upload: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 7.5 12 3m0 0 4.5 4.5M12 3v13.5',
  qr: 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16',
  camera: 'M4 7h2.5l1-2h9l1 2H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  undo: 'M9 14 4 9l5-5M4 9h9a7 7 0 1 1-7 7',
  printer: 'M6 9V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5M4 9h16v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9ZM8 13h8v6H8v-6Z',
  trash: 'M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7m2 0v12.5A1.5 1.5 0 0 1 15.5 21h-7A1.5 1.5 0 0 1 7 19.5V7h10ZM10 11v6M14 11v6',
  // Wayfinding pictograms, one per page.
  dashboard: 'M4 4.75C4 4.34 4.34 4 4.75 4h5c.41 0 .75.34.75.75v5c0 .41-.34.75-.75.75h-5A.75.75 0 0 1 4 9.75v-5Zm9.5 0c0-.41.34-.75.75-.75h5c.41 0 .75.34.75.75v5c0 .41-.34.75-.75.75h-5a.75.75 0 0 1-.75-.75v-5ZM4 14.25c0-.41.34-.75.75-.75h5c.41 0 .75.34.75.75v5c0 .41-.34.75-.75.75h-5a.75.75 0 0 1-.75-.75v-5Zm9.5 0c0-.41.34-.75.75-.75h5c.41 0 .75.34.75.75v5c0 .41-.34.75-.75.75h-5a.75.75 0 0 1-.75-.75v-5Z',
  sessions: 'M9 4.5H7.5A1.5 1.5 0 0 0 6 6v13.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5 1.5 1.5 0 0 1 13.5 6h-3A1.5 1.5 0 0 1 9 4.5ZM9 13.5l2 2 4-4.5',
  inventory: 'M12 3 20.25 7.5v9L12 21l-8.25-4.5v-9L12 3ZM3.75 7.5 12 12l8.25-4.5M12 12v9',
  archive: 'M3.75 4.5h16.5v3.75H3.75V4.5Zm1.5 3.75h13.5v10.5a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5V8.25ZM9.75 12h4.5',
  devices: 'M3 5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25v9.5H3v-9.5ZM1.5 17.25h21v.5a2.25 2.25 0 0 1-2.25 2.25H3.75a2.25 2.25 0 0 1-2.25-2.25v-.5Z',
  employees: 'M15 19.5v-1.25A3.25 3.25 0 0 0 11.75 15h-5.5A3.25 3.25 0 0 0 3 18.25v1.25M9 12a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 9 12Zm12 7.5v-1.25a3.25 3.25 0 0 0-2.44-3.15M15.75 5.6a3.25 3.25 0 0 1 0 6.3',
  handouts: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  import: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
  users: 'M17.98 18.72A7.47 7.47 0 0 0 12 15.75a7.47 7.47 0 0 0-5.98 2.97M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  register: 'M18 7.5v6m3-3h-6M13.5 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM3 20.1a6.75 6.75 0 0 1 13.5 0',
  departments: 'M3.75 21h16.5M5.25 21V4.5A1.5 1.5 0 0 1 6.75 3h7.5a1.5 1.5 0 0 1 1.5 1.5V21M15.75 9h1.5a1.5 1.5 0 0 1 1.5 1.5V21M8.25 7.5h1.5m1.5 0h1.5m-4.5 3.75h1.5m1.5 0h1.5m-4.5 3.75h1.5m1.5 0h1.5',
  search: 'm20.25 20.25-4.5-4.5M10.5 17.25a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5Z',
  signOut: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 12h9m0 0-3-3m3 3-3 3',
  chevronRight: 'm8.25 4.5 7.5 7.5-7.5 7.5',
  enter: 'M9 10.5 4.5 15 9 19.5M4.5 15h11.25A3.75 3.75 0 0 0 19.5 11.25V4.5',
}

export default function Icon({ name, size = 18, title, className = '' }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false">
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  )
}

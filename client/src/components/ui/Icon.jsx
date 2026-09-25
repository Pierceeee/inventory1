/**
 * Inline SVG icon set. No icon dependency: this app needs eight glyphs, and a
 * package would cost more than it saves.
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

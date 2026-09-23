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

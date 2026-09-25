/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'

// Wayfinding Signage: a graphite sign panel, one interaction blue, one
// "you are here" yellow, and a small line-colour key per zone. The zone
// keys mark where you are; they never fill a region.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Overpass', ...defaultTheme.fontFamily.sans],
        mono: ['ui-monospace', 'Cascadia Mono', 'Consolas', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // The sign panel and primary actions.
        ink: {
          DEFAULT: '#1E2733', 950: '#141B24', 900: '#1E2733', 800: '#2A3544',
          700: '#3A4658', 600: '#556275', 400: '#8D98A8', 300: '#B6BFCB',
        },
        // Interaction: links, focus, selected controls.
        brand: {
          50: '#EEF3FC', 100: '#DCE6F9', 200: '#B9CDF2', 500: '#3A6FD8',
          600: '#2459C4', 700: '#1D4AA6', 800: '#183C86',
        },
        // "You are here" - the current location marker, nothing else.
        signal: '#F2B705',
        // Zone keys (Overview, Audits, Custody, Admin).
        zone: { overview: '#8D98A8', audits: '#0E7C74', custody: '#2459C4', admin: '#7A8699' },
        canvas: '#F5F6F8',
        ok:   { 50: '#ECF7F3', 200: '#B5DFCF', 600: '#12805C', 700: '#0B6B4C' },
        warn: { 50: '#FFF8E6', 200: '#F3D899', 600: '#B7791F', 700: '#94580E' },
        bad:  { 50: '#FDF0EF', 200: '#F2C4BF', 600: '#C0392B', 700: '#A12A1E' },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(20, 27, 36, 0.05)',
        overlay: '0 12px 32px -8px rgba(20, 27, 36, 0.28), 0 2px 6px rgba(20, 27, 36, 0.08)',
      },
      keyframes: {
        'overlay-in': { from: { opacity: '0', transform: 'translateY(-6px) scale(0.99)' }, to: { opacity: '1', transform: 'none' } },
        'scrim-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'overlay-in': 'overlay-in 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scrim-in': 'scrim-in 120ms ease-out',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1',
          600: '#4f46e5', 700: '#4338ca',
        },
        ok:   { 50: '#ecfdf5', 700: '#047857' },
        warn: { 50: '#fffbeb', 700: '#b45309' },
        bad:  { 50: '#fef2f2', 700: '#b91c1c' },
      },
    },
  },
  plugins: [],
}

// Lint rules for the whole repo: `npm run lint`.
// The browser app (client) and the API (server) get their own globals; the
// React rules apply to the client only.
import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'e2e/.client-dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': 'warn',
    },
  },
  {
    // The API logs to the console on purpose (startup, errors).
    files: ['server/**/*.{js,mjs}', 'e2e/**/*.{js,mjs}', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Vitest runs with globals on (describe, test, expect, vi).
    files: ['**/*.test.{js,jsx}', '**/test/**/*.{js,jsx}', 'client/src/test/**'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
]

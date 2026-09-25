import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // One .env at the repo root serves server and client. Only VITE_-prefixed
  // values ever reach the browser bundle.
  //
  // security MEDIUM (review fix #7): e2e/support/globalSetup.mjs builds an
  // ISOLATED bundle for the Group 6 production smoke test and sets these two
  // env vars when it does - VITE_ENV_DIR points away from the real
  // repo-root .env (that build must never read real secrets/values, per the
  // hard safety rule of never touching .env), and VITE_OUT_DIR points at a
  // throwaway directory (that build must never overwrite the real
  // client/dist a human's `npm run build` produced). Every other caller
  // (`npm run build`, `npm run dev`, `npm run preview`) never sets either, so
  // envDir/outDir stay Vite's/this repo's normal defaults - unchanged.
  const envDir = process.env.VITE_ENV_DIR || '..'
  const env = loadEnv(mode, envDir, '')
  const api = { '/api': `http://127.0.0.1:${env.PORT || 3001}` }

  return {
    plugins: [react()],
    envDir,
    build: process.env.VITE_OUT_DIR ? { outDir: process.env.VITE_OUT_DIR, emptyOutDir: true } : undefined,
    server: { port: 5173, proxy: api },
    preview: { proxy: api },
  }
})

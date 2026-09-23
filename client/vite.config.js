import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // One .env at the repo root serves server and client. Only VITE_-prefixed
  // values ever reach the browser bundle.
  const env = loadEnv(mode, '..', '')
  const api = { '/api': `http://127.0.0.1:${env.PORT || 3001}` }

  return {
    plugins: [react()],
    envDir: '..',
    server: { port: 5173, proxy: api },
    preview: { proxy: api },
  }
})

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Each file boots its own in-process Postgres.
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
})

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
    reporters: ['verbose'],
    coverage: { provider: 'v8' },
  },
})

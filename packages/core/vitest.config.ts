import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    environment: 'node',
    setupFiles: ['./src/mocks/setup.ts'],
  },
})

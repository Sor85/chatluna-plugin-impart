import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 30000, hookTimeout: 30000, restoreMocks: true, fileParallelism: false }
})

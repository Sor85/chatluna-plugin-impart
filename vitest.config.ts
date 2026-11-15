import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  plugins: [{
    // The host bundler loads locale .yml files; tests never read locale text, and vitest 4 parses
    // the original file even under vi.mock, so stub it as an empty module.
    name: 'impart-yml-stub',
    enforce: 'pre',
    transform: (_code, id) => /\.ya?ml(\?|$)/.test(id) ? { code: 'export default {}', map: null } : undefined
  }],
  test: { include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 30000, hookTimeout: 30000, restoreMocks: true, fileParallelism: false }
})

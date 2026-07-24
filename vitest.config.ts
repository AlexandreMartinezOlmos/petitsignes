import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // `src/lib` is plain TypeScript; jsdom is only needed for the localStorage
    // implementation of ProgressStore.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'lcov'],
      /**
       * A ratchet, not a target. The floor sits just under what the suite
       * measures today (64% statements, 57% branches, 70% functions), so it
       * fails when coverage *drops* and never on the day it is introduced — a
       * threshold set above reality gets lowered on first contact and then
       * means nothing.
       *
       * It reads low because it only counts unit tests: the DOM controller in
       * `catalogue-grid.ts` and the wiring in `stores.ts` are exercised
       * end to end by Playwright, which v8 does not see. Raise these numbers
       * when new logic arrives with its own tests; do not chase them by
       * unit-testing the browser.
       */
      thresholds: {
        statements: 62,
        branches: 55,
        functions: 68,
        lines: 62,
      },
    },
  },
});

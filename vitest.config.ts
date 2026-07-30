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
       * measures today (73.72% statements, 67.78% branches, 84.28% functions,
       * 74.88% lines), so it fails when coverage *drops* and never on the day
       * it is set — a threshold above reality gets lowered on first contact and
       * then means nothing.
       *
       * **Raise it when coverage rises.** These sat at 62/55/68 while the suite
       * climbed past them, which opened seven points of slack: coverage could
       * have fallen that far in silence, which is exactly what a ratchet exists
       * to prevent. A floor that stops following the ceiling stops being a floor.
       *
       * It reads low because it only counts unit tests: the DOM controller in
       * `catalogue-grid.ts` and the history wiring in `catalogue-history.ts` are
       * exercised end to end by Playwright, which v8 does not see. Do not chase
       * those numbers by unit-testing the browser — jsdom mocks would buy a nicer
       * percentage and less real confidence.
       *
       * That blind spot is also the only reason this ever moves *down*, and it
       * has to be argued rather than assumed. It happened once: extracting
       * `mountSignCards` so the 404's card works added seven statements of
       * browser wiring to the counted set, all of them covered by Playwright
       * and none of them visible to v8, so the percentage fell while real
       * coverage rose. Lowering the floor for any other reason is the move this
       * comment exists to make someone justify in writing.
       *
       * Which is the point of the last move *up*. Restoring the catalogue's
       * filters added another forty statements of that same unmeasurable wiring
       * and the floor looked like it had to come down — until the table showed
       * `stores.ts` at 0% of its functions. Those are not browser-bound at all:
       * they work against the `ProgressStore` interface, and `setProgressStore`
       * had been sitting there the whole time for exactly this. Closing that gap
       * (33% → 97%) put every metric above where it started. Read the per-file
       * table before believing a drop is structural.
       */
      thresholds: {
        statements: 73,
        branches: 67,
        functions: 84,
        lines: 74,
      },
    },
  },
});

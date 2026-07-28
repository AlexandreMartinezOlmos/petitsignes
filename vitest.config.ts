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
       * measures today (69.26% statements, 63.09% branches, 80.18% functions,
       * 70.14% lines), so it fails when coverage *drops* and never on the day
       * it is set — a threshold above reality gets lowered on first contact and
       * then means nothing.
       *
       * **Raise it when coverage rises.** These sat at 62/55/68 while the suite
       * climbed past them, which opened seven points of slack: coverage could
       * have fallen that far in silence, which is exactly what a ratchet exists
       * to prevent. A floor that stops following the ceiling stops being a floor.
       *
       * It reads low because it only counts unit tests: the DOM controller in
       * `catalogue-grid.ts` and the wiring in `stores.ts` are exercised
       * end to end by Playwright, which v8 does not see. Do not chase those
       * numbers by unit-testing the browser — jsdom mocks would buy a nicer
       * percentage and less real confidence.
       *
       * That blind spot is also the only reason this ever moves *down*, and it
       * has to be argued rather than assumed. It happened once: extracting
       * `mountSignCards` so the 404's card works added seven statements of
       * browser wiring to the counted set, all of them covered by Playwright
       * and none of them visible to v8, so the percentage fell while real
       * coverage rose. Lowering the floor for any other reason is the move this
       * comment exists to make someone justify in writing.
       */
      thresholds: {
        statements: 69,
        branches: 63,
        functions: 80,
        lines: 70,
      },
    },
  },
});

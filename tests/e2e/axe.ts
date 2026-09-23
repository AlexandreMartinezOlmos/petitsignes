import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * The success criteria the accessibility statement promises: WCAG 2.0, 2.1 and
 * 2.2, levels A and AA. axe files each rule under the version that introduced
 * it, so all five tags are needed — `wcag2aa` alone would skip every level-A
 * rule, including missing alt text and unlabelled controls.
 */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Rules outside the WCAG tags that the sweep still enforces.
 *
 * `heading-order` sits under `best-practice`, but a skipped level is how the
 * category page once went from `h1` straight to the cards' `h3`, and only
 * Lighthouse noticed. Naming it rather than pulling in all of `best-practice`
 * keeps the sweep about defects and not about style.
 */
export const EXTRA_RULES = ['heading-order'];

/**
 * An axe scan of the page as it stands, against {@link WCAG_TAGS} plus
 * {@link EXTRA_RULES}.
 *
 * Built from `options()` rather than the builder's `withTags()` and
 * `withRules()` on purpose. Those two both write axe's single `runOnly` field,
 * so chaining them keeps only the last call: `withTags([...]).withRules(['x'])`
 * reads as "WCAG plus x" and runs x alone. The sweep ran like that, reporting
 * a clean site while checking one rule, until a canary page proved it blind.
 */
export function wcagScan(page: Page): AxeBuilder {
  return new AxeBuilder({ page }).options({
    runOnly: { type: 'tag', values: WCAG_TAGS },
    rules: Object.fromEntries(EXTRA_RULES.map((id) => [id, { enabled: true }])),
  });
}

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Automated accessibility checks (docs/requisitos.md §4.8).
 *
 * axe catches roughly a third of real issues, so this complements — never
 * replaces — manual keyboard and screen reader review.
 */
const PAGES = [
  { name: 'catalogue (ca)', path: '/' },
  { name: 'catalogue (es)', path: '/es/' },
  { name: 'credits (ca)', path: '/credits/' },
  { name: 'credits (es)', path: '/es/credits/' },
  { name: 'accessibility statement (ca)', path: '/accessibilitat/' },
  { name: 'accessibility statement (es)', path: '/es/accessibilitat/' },
];

for (const { name, path } of PAGES) {
  test(`${name} has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test('colour contrast holds in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  // The dark palette must actually be in force, or this proves nothing.
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');

  const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();

  expect(results.violations).toEqual([]);
});

/**
 * WCAG 2.2 §2.4.11: a sticky header must not cover the element that has focus.
 * Tabbing through the grid scrolls cards into view, so they have to clear it.
 */
test('the sticky header never covers the focused element', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const headerBottom = await page
    .locator('#app-header')
    .evaluate((el) => el.getBoundingClientRect().bottom);

  // Focus a card deep enough down the grid that the browser has to scroll.
  const target = page.locator('.sign-card [data-action="favorite"]').nth(20);
  await target.focus();
  await page.waitForTimeout(300);

  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(headerBottom - 1);
});

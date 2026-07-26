import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Automated accessibility checks.
 *
 * axe catches roughly a third of real issues, so this complements — never
 * replaces — manual keyboard and screen reader review.
 */
const PAGES = [
  { name: 'catalogue (ca)', path: '/' },
  { name: 'catalogue (es)', path: '/es/' },
  { name: 'about (ca)', path: '/el-projecte/' },
  { name: 'about (es)', path: '/es/el-projecte/' },
  { name: 'credits (ca)', path: '/credits/' },
  { name: 'credits (es)', path: '/es/credits/' },
  { name: 'accessibility statement (ca)', path: '/accessibilitat/' },
  { name: 'accessibility statement (es)', path: '/es/accessibilitat/' },
];

for (const { name, path } of PAGES) {
  test(`${name} has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);

    // Scan the hydrated DOM, not the snapshot before it: islands add controls,
    // and a `client:visible` one mounts only once it has been scrolled to.
    // Waiting also keeps a mid-scan hydration from destroying axe's context.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
    await page.evaluate(() => window.scrollTo(0, 0));

    // Two frames after hydration: the `ssr` attribute drops when the island
    // mounts, but React may still be committing. Scanning into that window is
    // what made this sweep fail intermittently on the pages that have islands.
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)));
        }),
    );

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

/**
 * axe cannot catch this: every group had an accessible name, they were just
 * wrong. Two groups sharing a name are indistinguishable when navigating by
 * region, and a group named after one of its own buttons announces twice.
 */
test('each control group has its own accessible name', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const names = await page
    .locator('[role="group"]')
    .evaluateAll((groups) => groups.map((group) => group.getAttribute('aria-label') ?? ''));

  expect(names.length).toBeGreaterThan(1);
  expect(names).not.toContain('');
  expect(new Set(names).size, `duplicate group names: ${names.join(', ')}`).toBe(names.length);
});

test('colour contrast holds in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  // The dark palette must actually be in force, or this proves nothing.
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');

  const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();

  expect(results.violations).toEqual([]);
});

/**
 * Translucency is the one part of this design that can degrade legibility, so
 * the escape hatch has to actually work rather than merely exist in the
 * stylesheet. Playwright cannot emulate this query yet, so it is set through
 * the DevTools protocol; both projects run on Chromium.
 */
test('glass turns solid when the visitor has asked for less transparency', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'media emulation is set through CDP');

  await page.goto('/');
  const header = page.locator('#app-header');

  const translucent = await header.evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(translucent, 'the header should be glass by default').toContain('blur');

  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });

  await expect(header).toHaveCSS('backdrop-filter', 'none');

  // Opaque means opaque: a surface that is still 86% tinted would keep the
  // contrast dependent on whatever scrolls behind it, which is the whole
  // reason the query is honoured.
  const alpha = await header.evaluate((el) => {
    const bg = getComputedStyle(el).backgroundColor;
    const match = bg.match(/\/\s*([\d.]+)\s*\)$/) ?? bg.match(/,\s*([\d.]+)\s*\)$/);
    return match ? Number(match[1]) : 1;
  });
  expect(alpha).toBe(1);
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

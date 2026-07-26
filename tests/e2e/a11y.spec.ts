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
 * WCAG 2.2 §1.4.10 (Reflow): usable at 320 CSS px without scrolling in two
 * directions. 320px is also what a 1280px window becomes at 400% zoom, so this
 * one width covers both the smallest phones and anyone who magnifies.
 *
 * The header used to fail it: the wordmark and the language selector wanted
 * 315px of a 288px budget and pushed the document to 330px.
 */
for (const path of ['/', '/el-projecte/', '/credits/', '/accessibilitat/']) {
  test(`${path} reflows at 320px without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);

    // A `client:visible` island only mounts once it has been scrolled to, and
    // an island that has not mounted cannot overflow. Scrolling to the end
    // first is what makes this measure the page a visitor actually reaches.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

    const { overflow, culprits } = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      return {
        overflow: document.documentElement.scrollWidth - limit,
        // Naming the widest offenders turns a failure into a starting point.
        culprits: [...document.querySelectorAll('body *')]
          .filter((el) => el.getBoundingClientRect().right > limit + 0.5)
          .map(
            (el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`,
          )
          .slice(0, 5),
      };
    });

    expect(overflow, `overflowing: ${culprits.join(', ')}`).toBeLessThanOrEqual(0);
  });
}

/**
 * WCAG 2.2 §2.5.3 (Label in Name, level A): the accessible name must contain
 * the visible label, or someone driving the page by voice says what they can
 * read and nothing happens. The categories button announced "Mostra les 15
 * categories" while showing "+15 més", and "més" matched nothing.
 *
 * Swept rather than asserted case by case: the next control to grow an
 * `aria-label` is caught without anyone remembering to add a test.
 */
test('every visible label is contained in its accessible name', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const violations = await page.evaluate(() => {
    // Punctuation and case are not what a speech engine matches on.
    const normalise = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^\p{L}\p{N} ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return (
      [...document.querySelectorAll('button[aria-label], a[aria-label]')]
        .map((el) => ({
          visible: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
          name: el.getAttribute('aria-label') ?? '',
        }))
        // An icon-only control has no visible label, so the criterion does not apply.
        .filter(({ visible }) => visible !== '')
        .filter(({ visible, name }) => !normalise(name).includes(normalise(visible)))
        .map(({ visible, name }) => `"${visible}" is announced as "${name}"`)
    );
  });

  expect(violations).toEqual([]);
});

/**
 * WCAG 2.2 §2.5.8 asks 24px; this project's design system promises 44px for
 * every control (`--spacing-touch`), because the whole point is one-handed use
 * with a baby in the other arm. The footer links were 22px and were the only
 * controls breaking either number.
 */
test('every control meets the touch target floor', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const undersized = await page.evaluate(() =>
    [...document.querySelectorAll('a[href], button, input, [role="button"]')]
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && (box.width < 24 || box.height < 24))
      .map(
        ({ el, box }) =>
          `${(el.textContent ?? '').trim().slice(0, 24)} — ${Math.round(box.width)}x${Math.round(box.height)}`,
      ),
  );

  expect(undersized).toEqual([]);
});

/**
 * WCAG 2.2 §1.4.1: the card already signals a learned sign with a bar along its
 * top edge, so this is about the control itself. The favourite toggle fills its
 * star when pressed; the learned one only went from grey to green, which is
 * exactly the difference a red-green deficiency cannot see. Both now answer a
 * press by filling.
 */
test('both card toggles answer a press with more than a hue', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  for (const action of ['favorite', 'learned']) {
    const toggle = page.locator(`.sign-card [data-action="${action}"]`).first();
    const read = () =>
      toggle.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          background: style.backgroundColor,
          iconFill: getComputedStyle(el.querySelector('svg')!).fill,
        };
      });

    const before = await read();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const after = await read();

    // Either the control fills or its icon does — a colour swap alone is what
    // this test exists to reject.
    const filled = after.background !== before.background || after.iconFill !== before.iconFill;
    expect(filled, `${action} changed nothing but its colour`).toBe(true);
  }
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

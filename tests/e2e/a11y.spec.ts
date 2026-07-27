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
      // A control clipped to a pixel is one that only exists once focused —
      // the skip and bypass links. Measuring them at rest would report a 1px
      // target for something nobody can point at; their real size is asserted
      // in the tests that focus them.
      .filter(({ el }) => getComputedStyle(el).clipPath === 'none')
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
 * WCAG 2.4.1 (Bypass Blocks). The grid holds 638 of the page's 654 focus
 * stops, so the footer — and on a phone the only route to the other pages —
 * sat 650 Tab presses behind it. The bypass link is the escape hatch; this
 * pins both halves of it, because a skip link that does not move focus is the
 * classic way for one to rot unnoticed.
 */
test('the catalogue can be skipped from the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const bypass = page.locator('.bypass-link');
  await expect(bypass).toHaveAttribute('href', '#footer-nav');

  // Hidden until focused: it sits between the hero and the grid, so reserving
  // space for it the rest of the time would be a permanent gap.
  expect(await bypass.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThan(2);

  await bypass.focus();
  expect(await bypass.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(80);

  await bypass.press('Enter');
  // The target takes focus itself (`tabindex="-1"`), so the next Tab is
  // already the first footer link rather than the top of the document.
  await expect(page.locator('#footer-nav')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.footer-link').first()).toBeFocused();
});

/**
 * The header carries the rest of the site at every width now, including the
 * phone it was left off. What has to hold either way is that the reading order
 * and the tab order agree: the language selector comes first in the source, so
 * it must come first to the eye too — to the left of the navigation on one row
 * when there is width for one row, and on the row above it when there is not.
 * Any arrangement where one of the two overtakes the other at one breakpoint
 * puts the keyboard out of step with the page somewhere.
 */
test('the header navigation reads in the order it is tabbed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/credits/');

  const links = page.locator('.site-nav__link');
  await expect(links).toHaveCount(3);

  const boxOf = async (selector: string) => {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    return box!;
  };

  // One row, language selector first.
  let lang = await boxOf('.lang-switch');
  let nav = await boxOf('.site-nav');
  expect(nav.y).toBeLessThan(lang.y + lang.height);
  expect(lang.x + lang.width).toBeLessThanOrEqual(nav.x);

  // And that is the order the keyboard finds them in: skip link, wordmark,
  // the two locales, then the three pages.
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Tab');
  await expect(links.first()).toBeFocused();

  // Which page you are on is underlined, not only recoloured (WCAG 1.4.1).
  const current = page.locator('.site-nav__link[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(/crèdits/i);
  expect(await current.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('underline');

  // On a phone it wraps onto its own row *below* the selector — still after
  // it, so the source order is still the reading order.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(links.first()).toBeVisible();
  lang = await boxOf('.lang-switch');
  nav = await boxOf('.site-nav');
  expect(nav.y).toBeGreaterThanOrEqual(lang.y + lang.height);
});

/**
 * The phone navigation is only affordable because it folds with the filters
 * while the catalogue is being scrolled. Both halves matter: it has to go, and
 * it has to come back — and it must never fold away under a keyboard, or the
 * links would vanish mid-tab.
 */
test('the phone navigation folds while scrolling and returns', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const nav = page.locator('.site-nav__link').first();
  await expect(nav).toBeVisible();
  const tall = await page
    .locator('#app-header')
    .evaluate((el) => el.getBoundingClientRect().height);

  await page.mouse.wheel(0, 600);
  await expect(page.locator('#app-header')).toHaveAttribute('data-condensed', 'true');
  await expect(nav).toBeHidden();
  // Polled: the fold is a transition, so the height arrives a few frames after
  // the state does.
  await expect
    .poll(() => page.locator('#app-header').evaluate((el) => el.getBoundingClientRect().height))
    .toBeLessThan(tall - 100);

  // The observer ignores direction for 320ms after a fold, on purpose: folding
  // shortens the document, which fires a scroll event pointing the other way.
  // So the wait here is not flake padding, it is the debounce the feature has.
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, -300);
  await expect(page.locator('#app-header')).toHaveAttribute('data-condensed', 'false');
  await expect(nav).toBeVisible();

  // Focus inside the header holds it open whatever the scroll says.
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, 600);
  await expect(page.locator('#app-header')).toHaveAttribute('data-condensed', 'true');
  await page.locator('#sign-search').focus();
  await expect(nav).toBeVisible();
});

/**
 * B2. A phone held sideways is 844×390. The header was 227px of that and the
 * grid began below the fold, so the catalogue opened on nothing at all — and
 * the fold that should have rescued it announced `data-condensed="true"` and
 * changed no pixel, because its rules were behind `width < 40rem` and 844px is
 * not narrow. A state reported to assistive technology and contradicted by the
 * screen.
 */
test('a phone held sideways opens on the catalogue, not on the header', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const visibleCards = async () =>
    page.locator('.sign-card').evaluateAll(
      (cards) =>
        cards.filter((el) => {
          const box = el.getBoundingClientRect();
          return box.top < window.innerHeight && box.bottom > 0;
        }).length,
    );

  expect(await visibleCards()).toBeGreaterThan(0);

  // A poster card is 363px — taller than this whole viewport — so the row
  // layout is not a phone-width preference, it is what makes an entry fit.
  const cardHeight = await page
    .locator('.sign-card')
    .first()
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(cardHeight).toBeLessThan(200);

  // And now the fold does what it says.
  const header = page.locator('#app-header');
  const tall = await header.evaluate((el) => el.getBoundingClientRect().height);
  await page.mouse.wheel(0, 600);
  await expect(header).toHaveAttribute('data-condensed', 'true');
  await expect
    .poll(() => header.evaluate((el) => el.getBoundingClientRect().height))
    .toBeLessThan(tall - 60);
});

/**
 * D. Header plus hero was 54% of the first screen on a phone, on a tool people
 * come back to daily. Shrinking it from the second visit on would have meant a
 * layout decided by client state — a flash of the wrong height on every load —
 * so it is simply shorter, and the numbers are pinned here rather than left to
 * drift back.
 */
test('the first screen is mostly catalogue', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

    const chrome = await page.evaluate(() => {
      const header = document.getElementById('app-header')!.getBoundingClientRect().height;
      const hero = document.querySelector('.hero')!.getBoundingClientRect().height;
      return (header + hero) / window.innerHeight;
    });

    expect(chrome).toBeLessThanOrEqual(0.51);
  }

  // The lead never drops below the 16px the design system promises for body
  // text: the hero got shorter by spending less on space, not on legibility.
  const leadSize = await page
    .locator('.hero__lead')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(leadSize).toBeGreaterThanOrEqual(16);
});

/**
 * A search is a global lookup and ignores the category chips by design, but
 * nothing un-pressed them: picking `Primers signes` and then searching left
 * the chip `aria-pressed="true"` over results that are not first signs. The
 * interface lied to the eye and to the screen reader at once.
 */
test('the chips stop claiming a filter the search is not applying', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const firstSigns = page.locator('.chip', { hasText: 'Primers signes' });
  await firstSigns.click();
  await expect(firstSigns).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#sign-search').fill('gos');
  await expect(page.locator('.sign-card:not([hidden])')).not.toHaveCount(0);
  await expect(firstSigns).toHaveAttribute('aria-pressed', 'false');
  // Un-pressing without saying why would just be a different puzzle.
  await expect(page.locator('.toolbar__note')).toBeVisible();

  // The choice is suspended, not thrown away.
  await page.locator('#sign-search').fill('');
  await expect(firstSigns).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.toolbar__note')).toHaveCount(0);
});

/**
 * The live region announced "22 signes" — a number with no subject. Sighted
 * visitors read the lit chip; nobody else had anything.
 */
test('the result count says what it counted', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const count = page.locator('[aria-live="polite"]');
  await expect(count).toContainText('tot el catàleg');

  await page.locator('.chip', { hasText: 'Primers signes' }).click();
  await expect(count).toContainText('Primers signes');

  await page.locator('.chip-quiet', { hasText: 'Pendents' }).click();
  await expect(count).toContainText('Pendents');

  await page.locator('#sign-search').fill('gos');
  await expect(count).toContainText('gos');
});

/**
 * 49 of 229 cards have no video, and the note saying so wore the CTA's
 * silhouette: 44px tall, rounded, dashed outline. That is a disabled button,
 * which promises an action that cannot exist (§2.1).
 */
test('the missing-video note does not look like a disabled button', async ({ page }) => {
  await page.goto('/');

  const note = page.locator('.sign-card__novideo').first();
  await expect(note).toBeVisible();

  const shape = await note.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      borderWidth: style.borderTopWidth,
      radius: style.borderTopLeftRadius,
      // Still as tall as the CTA, which is what keeps a row of cards aligned.
      height: el.getBoundingClientRect().height,
    };
  });

  expect(shape.borderWidth).toBe('0px');
  expect(shape.radius).toBe('0px');
  expect(shape.height).toBeGreaterThanOrEqual(44);
});

/**
 * Print. Nurseries and midwives want a sheet of the signs they are working
 * on; the grid already hides filtered-out cards, so filtering and printing is
 * the feature. What must not come out is the chrome.
 */
test('printing drops the chrome and keeps the signs', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.emulateMedia({ media: 'print' });

  for (const selector of ['#app-header', '.bypass-link', '.sign-card__media']) {
    await expect(page.locator(selector).first()).toBeHidden();
  }

  await expect(page.locator('.sign-card').first()).toBeVisible();
  await expect(page.locator('.sign-card__title').first()).toBeVisible();

  // A card split across a page break is unreadable.
  const card = page.locator('.sign-card').first();
  expect(await card.evaluate((el) => getComputedStyle(el).breakInside)).toBe('avoid');
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

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
  // Served from every wrong address, so as public as any other page — and one
  // per locale, so `/es/…` fails in Spanish.
  { name: 'not found (ca)', path: '/404.html' },
  { name: 'not found (es)', path: '/es/404.html' },
  // One template, 390 pages. `leche` is the one that exercises every branch of
  // it: an embedded LSC video in Catalan, an external LSE link in Spanish, and
  // a declared source term in the citation block.
  { name: 'sign (ca)', path: '/signe/leche/' },
  { name: 'sign (es)', path: '/es/signe/leche/' },
  // One template, 30 pages. Food is the largest category, so it is the one whose
  // grid and fourteen sibling chips are most likely to break a rule.
  { name: 'category (ca)', path: '/categoria/menjar-i-beure/' },
  { name: 'category (es)', path: '/es/categoria/menjar-i-beure/' },
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

    // `heading-order` is not in any WCAG tag — axe files it under
    // `best-practice` — so this sweep was blind to a skipped heading level until
    // Lighthouse reported one: the category page went `h1` straight to the
    // cards' `h3`. Naming the rule rather than pulling in the whole
    // `best-practice` set keeps the sweep about defects and not about style.
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .withRules(['heading-order'])
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
 *
 * Looped across every page in `PAGES`, not only `/`: H3 gave the sign page's
 * two toggles a visible caption (`aria-hidden`, sitting beside the icon) that
 * the state-changing `aria-label` has to keep containing. `textContent` reads
 * straight through `aria-hidden` — it is a DOM property, not an accessibility
 * one — so this check exercises the real rendered markup exactly the way the
 * `i18n.test.ts` string-level pin cannot: it would catch the caption ending up
 * outside the button, or the wrong translation key, not only a mismatched pair
 * of strings.
 */
for (const { name, path } of PAGES) {
  test(`every visible label is contained in its accessible name (${name})`, async ({ page }) => {
    await page.goto(path);

    // Same as the axe sweep above: `/el-projecte/` hydrates `ProgressData`
    // with `client:visible`, so its controls never mount — and this check
    // never finishes waiting for their `ssr` attribute to clear — without
    // scrolling it into view first.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
    await page.evaluate(() => window.scrollTo(0, 0));

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
}

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

    // Back to 0.51 after the "with video" chip was removed. That chip had
    // taken the phone's filter row from one line to two — 44px to 96px, and
    // the header with it — and the trade was only worth 0.58 while 49 of 229
    // signs were dead ends. The premise now is that every word gets a video or
    // a link to its official entry, so there is nothing left to filter out and
    // the row fits across 358px again.
    //
    // Well below the 62% this audit started from. Do not raise it without the
    // same kind of reason written down.
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
 * Every concept in the catalogue has a video today (see `contenido.md`), so
 * `.sign-card__novideo` no longer appears in any shipped card — but the rule
 * it exists for is not "we happen to have full coverage", it is §2.1: a
 * concept with no official source is never filled with a guess, so the next
 * one added without a video still needs this note, not a silent gap. The
 * class survives in `SignCard.astro` for that day. Since no real card can
 * exercise it right now, this injects the exact markup the component would
 * render and checks its computed shape directly: it once wore the CTA's
 * silhouette — 44px tall, rounded, dashed outline — a disabled button
 * promising an action that cannot exist.
 */
test('the missing-video note does not look like a disabled button', async ({ page }) => {
  await page.goto('/');

  const shape = await page.evaluate(() => {
    const card = document.querySelector('.sign-card');
    if (!card) throw new Error('no card to graft the note onto');
    const note = document.createElement('p');
    note.className = 'sign-card__novideo';
    note.textContent = 'Sense vídeo en LSC';
    card.appendChild(note);
    const style = getComputedStyle(note);
    const result = {
      borderWidth: style.borderTopWidth,
      radius: style.borderTopLeftRadius,
      // Still as tall as the CTA, which is what keeps a row of cards aligned.
      height: note.getBoundingClientRect().height,
    };
    note.remove();
    return result;
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

/**
 * C1. The card said the same thing three times: the section heading, the chip
 * under the word, and the media block showing the category's icon. 217 of the
 * 229 chips repeated their heading word for word — the headings arrived after
 * the chip did, and that is what left it with nothing to say.
 */
test('the category chip only appears where it adds something', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const repeats = await page.evaluate(() => {
    let heading: string | null = null;
    let duplicates = 0;
    let informative = 0;
    for (const el of document.getElementById('sign-grid')!.children) {
      if (el.classList.contains('grid-section')) heading = el.textContent!.trim();
      else if (el.classList.contains('sign-card')) {
        const chip = el.querySelector('.sign-card__chip')?.textContent?.trim();
        if (!chip) continue;
        if (chip === heading) duplicates += 1;
        else informative += 1;
      }
    }
    return { duplicates, informative };
  });

  expect(repeats.duplicates).toBe(0);
  // The curated route is the one heading that is not a category, so its cards
  // are the ones where the chip still says something. Losing these would be
  // the opposite mistake.
  expect(repeats.informative).toBeGreaterThan(0);
});

/**
 * C2. The word is what somebody came to read, and it was the third loudest
 * thing on its own card: the chip matched it pixel for pixel at 115px, and the
 * call to action was 234px of solid brand repeated identically on 180 cards.
 */
test('the word is the loudest thing on the card', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const card = page.locator('.sign-card[data-first-sign="false"]').first();
  const sizes = await card.evaluate((el) => {
    const size = (selector: string) => {
      const found = el.querySelector(selector);
      return found ? parseFloat(getComputedStyle(found).fontSize) : 0;
    };
    return { word: size('.sign-card__title'), cta: size('.sign-card__cta') };
  });

  expect(sizes.word).toBeGreaterThan(sizes.cta);

  // The action is still unmistakably the action — it just stopped shouting.
  const cta = card.locator('.sign-card__cta');
  await expect(cta).toBeVisible();
  expect(await cta.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});

/**
 * The toggles moved onto the image. Two things have to survive that: the 44px
 * target, and a focus ring that is visible against a surface that changes
 * colour with every category.
 */
test('the toggles stay aimable and visible on the image', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const card = page.locator('.sign-card').first();
  const favorite = card.locator('[data-action="favorite"]');

  const geometry = await card.evaluate((el) => {
    const button = el.querySelector('[data-action="favorite"]')!.getBoundingClientRect();
    const media = el.querySelector('.sign-card__media')!.getBoundingClientRect();
    return {
      size: Math.min(button.width, button.height),
      onTheImage:
        button.top >= media.top - 1 &&
        button.bottom <= media.bottom + 1 &&
        button.right <= media.right + 1,
    };
  });

  expect(geometry.size).toBeGreaterThanOrEqual(44);
  expect(geometry.onTheImage).toBe(true);

  // Reached by keyboard, so the ring is the real `:focus-visible` one rather
  // than whatever a programmatic focus would show.
  await favorite.press('Tab');
  await favorite.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const ring = await favorite.evaluate((el) => {
    const style = getComputedStyle(el);
    return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
  });
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThanOrEqual(2);

  // And it still works as a control.
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
});

/**
 * The compact row is untouched by all of the above: on a phone the tile is
 * 56px and two 44px targets do not go inside it, so the toggles stay in their
 * trailing column.
 */
test('the phone card keeps its own layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const placement = await page
    .locator('.sign-card')
    .first()
    .evaluate((el) => {
      const button = el.querySelector('[data-action="favorite"]')!.getBoundingClientRect();
      const media = el.querySelector('.sign-card__media')!.getBoundingClientRect();
      return {
        overlaps: button.left < media.right,
        position: getComputedStyle(el.querySelector('.sign-card__toggles')!).position,
      };
    });

  expect(placement.overlaps).toBe(false);
  expect(placement.position).toBe('static');
});

/**
 * E. The three text pages were prose on cream with no route back: the wordmark
 * was the only way to the catalogue and a wordmark does not read as a link.
 */
const TEXT_PAGES = ['/el-projecte/', '/credits/', '/accessibilitat/'];

test('every text page offers a way back to the catalogue', async ({ page }) => {
  for (const path of TEXT_PAGES) {
    await page.goto(path);

    const crumb = page.locator('.breadcrumb__link');
    await expect(crumb).toHaveText(/catàleg/i);
    // The 44px floor the rest of the site meets, on the one control whose
    // absence was the finding.
    const box = await crumb.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // The last step is the page you are on, so it is stated rather than linked.
    await expect(page.locator('.breadcrumb__current')).toHaveAttribute('aria-current', 'page');

    await crumb.click();
    await expect(page.locator('#sign-grid')).toBeVisible();
  }
});

/**
 * The contents list and the headings come from one array, so a renamed or
 * removed section cannot leave an entry pointing at nothing. This is the test
 * that keeps that true if anyone ever writes the list out a second time.
 */
test('the contents list points at headings that exist', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const path of TEXT_PAGES) {
    await page.goto(path);

    const links = page.locator('.page-toc__link');
    const count = await links.count();
    expect(count).toBeGreaterThan(2);

    const headings = page.locator('.page-section__title');
    await expect(headings).toHaveCount(count);

    for (let i = 0; i < count; i += 1) {
      const href = await links.nth(i).getAttribute('href');
      const target = page.locator(`h2${href}`);
      await expect(target).toHaveCount(1);
      // Same text, not merely the same anchor: an entry that says something
      // other than its heading is a different kind of broken.
      await expect(target).toHaveText((await links.nth(i).innerText()).trim());
    }
  }
});

/**
 * A heading jumped to from the contents list has to clear the sticky header,
 * or the link delivers the section with its own title hidden behind the
 * toolbar — the same criterion as 2.4.11, arrived at by a different route.
 */
test('an anchor lands below the sticky header', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/credits/');

  await page.locator('.page-toc__link', { hasText: 'Llicències' }).click();
  await page.waitForTimeout(300);

  const headerBottom = await page
    .locator('#app-header')
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const box = await page.locator('#licences').boundingBox();

  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(headerBottom - 1);
});

/**
 * G1. At 2560px the grid stopped at 1120px and four columns: 56% of the screen
 * was margin. A maximum width is right for prose, which has a measure to
 * protect; a grid of 229 cards has none, and every extra pixel was going into
 * wider cards instead of more of them.
 */
test('a very wide screen gets more catalogue, not more margin', async ({ page }) => {
  const measure = async (width: number) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    return page.evaluate(() => {
      const grid = document.getElementById('sign-grid')!.getBoundingClientRect();
      const row = document.querySelector('.app-header__row')!.getBoundingClientRect();
      return {
        columns: getComputedStyle(document.getElementById('sign-grid')!).gridTemplateColumns.split(
          ' ',
        ).length,
        used: grid.width / window.innerWidth,
        // The header and the grid share one container, so their edges must
        // agree whatever the shell is doing. The 1rem is `main`'s own padding.
        aligned: Math.abs(grid.left - row.left - 16) < 2,
      };
    });
  };

  const wide = await measure(2560);
  expect(wide.columns).toBeGreaterThan(4);
  expect(wide.used).toBeGreaterThan(0.65);
  expect(wide.aligned).toBe(true);

  // And nothing changes on the width most people actually have: the floor is
  // the width the card already had, so 1280 keeps its four columns.
  const laptop = await measure(1280);
  expect(laptop.columns).toBe(4);
  expect(laptop.aligned).toBe(true);
});

/**
 * The finding measured 624px of text in a 1152px `main` — 46% of the page
 * empty down one side. The measure was never the problem, so the column keeps
 * its width and the space beside it got a job.
 */
test('the text pages stop wasting half the width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/accessibilitat/');

  const used = await page.evaluate(() => {
    const main = document.getElementById('main')!.getBoundingClientRect().width;
    const prose = document.querySelector('.page-prose')!.getBoundingClientRect().width;
    const aside = document.querySelector('.page-aside')!.getBoundingClientRect().width;
    return (prose + aside) / main;
  });
  expect(used).toBeGreaterThan(0.7);

  // The measure itself stays where it was: comfortable, not stretched.
  const chars = await page
    .locator('.page-prose p')
    .first()
    .evaluate((el) => {
      const size = parseFloat(getComputedStyle(el).fontSize);
      return el.getBoundingClientRect().width / (size * 0.5);
    });
  expect(chars).toBeLessThan(80);

  // Nothing in the aside is missing from the article, which is what makes it
  // safe to drop below `lg`.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.page-aside')).toBeHidden();
  await expect(page.locator('.page-section__title').first()).toBeVisible();
});

/**
 * P1. The link had no preview image, which is the whole of a WhatsApp share:
 * a project meant to travel between parents was arriving as a line of grey
 * text. These tags are the only part of the site that is never rendered for
 * the person who published it, so nothing but a test tells you they are wrong.
 */
test('every page offers a social card that a share sheet can actually fetch', async ({ page }) => {
  for (const path of ['/', '/es/', '/credits/']) {
    await page.goto(path);

    const card = await page.evaluate(() => {
      const meta = (property: string) =>
        document
          .querySelector(`meta[property="${property}"], meta[name="${property}"]`)
          ?.getAttribute('content') ?? null;
      return {
        image: meta('og:image'),
        width: meta('og:image:width'),
        height: meta('og:image:height'),
        alt: meta('og:image:alt'),
        url: meta('og:url'),
        twitter: meta('twitter:card'),
      };
    });

    // Absolute, because the share sheet fetches this from its own servers and
    // has no page to resolve a relative path against.
    expect(card.image, path).toMatch(/^https?:\/\//);
    expect(card.url, path).toMatch(/^https?:\/\//);
    expect(card.width, path).toBe('1200');
    expect(card.height, path).toBe('630');
    expect(card.alt, path).toBeTruthy();
    expect(card.twitter, path).toBe('summary_large_image');
  }

  // The file has to exist as well as be declared: a 404 here is a blank card.
  const response = await page.request.get('/og.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
});

/**
 * P4. "Add to home screen" left a generic icon on the one device this site is
 * designed for. iOS ignores the manifest entirely, which is why the PNG is
 * linked directly as well as listed there.
 */
test('the site can be installed to a home screen without looking generic', async ({ page }) => {
  await page.goto('/');

  const icons = await page.evaluate(() => ({
    apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? null,
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null,
  }));
  expect(icons.apple).toBe('/apple-touch-icon.png');
  expect(icons.manifest).toBe('/site.webmanifest');

  for (const asset of ['/apple-touch-icon.png', '/icon-192.png', '/icon-512.png']) {
    expect((await page.request.get(asset)).status(), asset).toBe(200);
  }

  const manifest = await (await page.request.get('/site.webmanifest')).json();
  expect(manifest.name).toBeTruthy();
  expect(manifest.start_url).toBe('/');
  // Both sizes, or Android substitutes a blurred upscale on the splash screen.
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
});

/**
 * P3. `/sitemap.xml` used to answer with the homepage's HTML and a 200, which
 * is worse than a 404: anything asking for it got told everything was fine and
 * handed the wrong document.
 */
test('the sitemap lists both languages of every page and points at itself from robots', async ({
  page,
}) => {
  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('xml');

  const xml = await sitemap.text();
  expect(xml.startsWith('<?xml')).toBe(true);
  for (const path of ['/', '/es/', '/el-projecte/', '/es/el-projecte/']) {
    expect(xml, path).toContain(`${path}</loc>`);
  }
  // The alternates are the point: without them the two locales read as
  // duplicates rather than as one page in two languages.
  expect(xml).toContain('hreflang="x-default"');

  const robots = await page.request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const text = await robots.text();
  expect(text).toContain('Sitemap:');
  expect(text).toContain('/sitemap.xml');
});

/**
 * P2. Any wrong address served the homepage with a 200: a mistyped link looked
 * like it had worked, and search engines were free to index endless duplicates
 * of the catalogue.
 *
 * There is one page per locale rather than one for the site. Cloudflare Pages
 * serves the closest `404.html` up the directory tree, so `/es/…` finds the
 * Spanish one — which is also what lets each build ship a single sign language
 * (§4.4) instead of guessing a language from the path and rendering both.
 */
test.describe('a wrong address', () => {
  const CASES = [
    { name: 'Catalan', page: '/404.html', lang: 'ca', signLanguage: 'lsc', home: '/' },
    { name: 'Spanish', page: '/es/404.html', lang: 'es', signLanguage: 'lse', home: '/es/' },
  ];

  for (const { name, page: path, lang, signLanguage, home } of CASES) {
    test(`says so in ${name} and offers the way back it was already reading`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('h1')).toBeVisible();

      // It must not claim to be a real page: one document answers thousands of
      // addresses, so a canonical link would assert they are all the same URL.
      const head = await page.evaluate(() => ({
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
        canonical: document.querySelector('link[rel="canonical"]'),
        alternates: document.querySelectorAll('link[rel="alternate"]').length,
      }));
      expect(head.robots).toContain('noindex');
      expect(head.canonical).toBeNull();
      expect(head.alternates).toBe(0);

      // One route, in the language being read. The header still carries the
      // language switch, so a second button here would compete with the way out.
      const route = page.locator('.not-found__route');
      await expect(route).toHaveCount(1);
      await expect(route).toHaveAttribute('href', home);
      expect((await route.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await page.request.get(home)).status()).toBe(200);

      // The card carries this route's sign language and no other.
      const languages = await page
        .locator('.sign-card__lang')
        .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.sl));
      expect(languages).toEqual([signLanguage]);
    });
  }

  /**
   * The toggles shipped inert on the first attempt: the card was rendered but
   * nothing wired it, so pressing favourite did nothing at all. That is the
   * same broken promise C3 took out of the missing-video note, and it is why
   * `mountSignCards` exists separately from the grid controller.
   */
  test('offers a card whose controls actually work', async ({ page }) => {
    await page.goto('/404.html');
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

    const card = page.locator('.sign-card');
    await expect(card).toHaveAttribute('data-sign-id', 'no');

    const favorite = card.locator('[data-action="favorite"]');
    await expect(favorite).toHaveAttribute('aria-pressed', 'false');
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');

    const learned = card.locator('[data-action="learned"]');
    await learned.click();
    await expect(learned).toHaveAttribute('aria-pressed', 'true');

    // Progress is progress wherever it was marked: the catalogue has to agree.
    await page.goto('/');
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
    const inGrid = page.locator('.sign-card[data-sign-id="no"]');
    await expect(inGrid.locator('[data-action="favorite"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(inGrid).toHaveAttribute('data-learned', 'true');
  });

  test('plays its sign without loading YouTube up front', async ({ page }) => {
    const youtube: string[] = [];
    page.on('request', (request) => {
      // Real YouTube hosts only. Matching the raw URL also catches our own
      // `youtube.ts` module, which the dev server serves by path.
      const host = new URL(request.url()).hostname;
      if (/(^|\.)(youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com)$/.test(host)) {
        youtube.push(request.url());
      }
    });

    await page.goto('/404.html');
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
    await page.waitForTimeout(300);
    expect(youtube).toEqual([]);

    await page.locator('.sign-card [data-action="play"]').click();
    await expect(page.locator('dialog[open]')).toBeVisible();
  });

  /**
   * The Spanish catalogue delivers LSE by linking out to DILSE rather than
   * embedding, so its 404 must offer a link, not a dead play button.
   */
  test('links out to the dictionary on the Spanish side', async ({ page }) => {
    await page.goto('/es/404.html');

    const cta = page.locator('.sign-card__cta--external');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', /fundacioncnse-dilse\.org/);
    await expect(page.locator('.sign-card [data-action="play"]')).toHaveCount(0);
  });
});

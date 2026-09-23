import { expect, test, type Page } from '@playwright/test';
import { stubCalls, stubYouTubeApi } from './youtube-stub.ts';

/**
 * Astro strips the `ssr` attribute from an island once it hydrates. Interacting
 * before that point silently drops the event, so every test waits for it.
 */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  // The grid controller stamps data-learned on every card once it mounts.
  await page.waitForFunction(
    () => document.querySelector('.sign-card')?.getAttribute('data-learned') !== null,
  );
}

async function visibleCards(page: Page): Promise<number> {
  return page.locator('.sign-card:not([hidden])').count();
}

test.describe('catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
  });

  test('renders the whole catalogue as static HTML', async ({ page }) => {
    // Not the whole 229 the catalogue started with — 34 concepts without a
    // verifiable source in one of the two sign languages were retired rather
    // than shipped with a placeholder (see `contenido.md`).
    expect(await visibleCards(page)).toBeGreaterThan(190);
  });

  test('search finds a sign by its Catalan label', async ({ page }) => {
    await page.getByPlaceholder(/cerca un signe/i).fill('gos');

    await expect(page.locator('.sign-card:not([hidden])')).toHaveCount(1);
    await expect(page.locator('.sign-card:not([hidden])')).toHaveAttribute('data-sign-id', 'perro');
  });

  test('search ignores accents and case', async ({ page }) => {
    await page.getByPlaceholder(/cerca un signe/i).fill('PLATANO');
    await expect(page.locator('.sign-card[data-sign-id="platano"]')).toBeVisible();
  });

  // Regression: the index needs two characters, so the first keystroke of every
  // search used to empty the grid.
  test('a single typed character does not empty the grid', async ({ page }) => {
    const before = await visibleCards(page);
    await page.getByPlaceholder(/cerca un signe/i).fill('g');

    expect(await visibleCards(page)).toBe(before);
    await expect(page.getByRole('status')).toBeHidden();
  });

  test('shows an empty state when nothing matches', async ({ page }) => {
    await page.getByPlaceholder(/cerca un signe/i).fill('zzzzzz');

    await expect(page.locator('.sign-card:not([hidden])')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('zzzzzz');
  });

  // Narrowing the grid by category moved to the `category filters` group
  // below, which has to expand the list first: the categories are collapsed
  // until asked for now, so reaching one is part of what the test proves.

  test('favourites survive a reload', async ({ page }) => {
    const card = page.locator('.sign-card[data-sign-id="leche"]');
    await card.getByRole('button', { name: /afegeix a preferits/i }).click();

    await expect(card.locator('[data-action="favorite"]')).toHaveAttribute('aria-pressed', 'true');

    await page.reload();

    await expect(
      page.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  // Opening signs in new tabs is an ordinary way to browse. Each tab used to
  // keep its own copy of the progress and save it whole, so the last one to
  // save quietly erased whatever the others had added.
  test('two open tabs keep each other’s progress, and show it live', async ({ page, context }) => {
    const other = await context.newPage();
    await other.goto('/');
    await waitForHydration(other);

    await other.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]').click();

    // No reload: the star appears here as soon as the other tab saves it.
    await expect(
      page.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]'),
    ).toHaveAttribute('aria-pressed', 'true');

    await page.locator('.sign-card[data-sign-id="agua"] [data-action="learned"]').click();

    await other.reload();
    await waitForHydration(other);
    await expect(
      other.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      other.locator('.sign-card[data-sign-id="agua"] [data-action="learned"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('the favourites filter shows only favourites', async ({ page }) => {
    await page
      .locator('.sign-card[data-sign-id="leche"]')
      .getByRole('button', { name: /afegeix a preferits/i })
      .click();

    await page.getByRole('button', { name: 'Preferits', exact: true }).click();

    await expect(page.locator('.sign-card:not([hidden])')).toHaveCount(1);
  });
});

test.describe('interface language', () => {
  // The interface language lives in the URL and couples to a sign language:
  // ca (/) → LSC, es (/es/) → LSE. Choosing it is decided at build time, so the
  // active state is server-rendered — no hydration, no wrong highlight.
  test('the default route is Catalan and shows LSC', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
    await expect(page.locator('html')).toHaveAttribute('data-sign-language', 'lsc');
    await expect(page.getByRole('link', { name: /Català/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('link', { name: /Castellano/ })).not.toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('switching to Spanish changes the URL, the UI and the sign language', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Castellano/ }).click();

    await expect(page).toHaveURL(/\/es\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('html')).toHaveAttribute('data-sign-language', 'lse');
    await expect(page.getByPlaceholder(/buscar un signo/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Castellano/ })).toHaveAttribute(
      'aria-current',
      'true',
    );

    // A card must never show the LSC block on the LSE route: the signs are
    // different gestures. The block is not merely hidden — it is not rendered,
    // so no style override can surface it.
    await expect(
      page.locator('.sign-card[data-sign-id="leche"] .sign-card__lang[data-sl="lsc"]'),
    ).toHaveCount(0);
    await expect(page.locator('.sign-card__lang[data-sl="lsc"]')).toHaveCount(0);
  });

  test('the header no longer carries redundant catalogue navigation', async ({ page }) => {
    await page.goto('/');

    // The header carries the wordmark, the site pages and the language
    // selector. What it must not carry is a second way to reach the catalogue
    // the visitor is already looking at, or a filter dressed up as a link —
    // `Primers signes` is a chip in the toolbar and belongs there.
    //
    // Scoped to the header and matched exactly: unscoped substring matching
    // also caught the catalogue's own bypass link ("Salta el catàleg"), which
    // is the opposite of redundant navigation.
    const header = page.locator('#app-header');
    await expect(header.getByRole('link', { name: 'Catàleg', exact: true })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'Primers signes', exact: true })).toHaveCount(0);
  });
});

test.describe('keyboard access', () => {
  test('the skip link is the first stop and reaches the content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    await expect(focused).toHaveClass(/skip-link/);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('card toggles are reachable and operable with the keyboard', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    const favorite = page
      .locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]')
      .first();

    await favorite.focus();
    await page.keyboard.press('Enter');

    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('video delivery', () => {
  const playLscLeche = (page: Page) =>
    page
      .locator(
        '.sign-card[data-sign-id="leche"] .sign-card__lang[data-sl="lsc"] [data-action="play"]',
      )
      .click();

  // Nothing is ever served from our own domain: LSC embeds the source's YouTube
  // player, LSE only links out.
  test('an LSC sign embeds the nocookie player, and nothing loads YouTube up front', async ({
    page,
  }) => {
    const youtubeRequests: string[] = [];
    page.on('request', (request) => {
      // Match real YouTube hosts only — not our own `youtube.ts` module.
      const host = new URL(request.url()).hostname;
      if (/(^|\.)(youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com)$/.test(host)) {
        youtubeRequests.push(request.url());
      }
    });

    await page.goto('/');
    await waitForHydration(page);

    // Browsing the catalogue must not contact YouTube at all.
    expect(youtubeRequests).toEqual([]);

    // Asserted on the request rather than on the iframe left in the page:
    // whether YouTube then agrees to play depends on the network — from CI it
    // refuses, and the dialog rightly swaps the frame for the source link.
    const embed = page.waitForRequest((request) =>
      /^https:\/\/www\.youtube-nocookie\.com\/embed\//.test(request.url()),
    );
    await playLscLeche(page);
    await embed;
  });

  /**
   * Regression: the dialog used to close itself when a clip ended. The player
   * reports `ENDED` and the dialog must rewind and play again in place.
   * Driven by the stand-in player, so the clip "ends" on cue instead of the
   * test waiting out a real video that CI is not allowed to play anyway.
   */
  test('a finished sign loops in place instead of closing the player', async ({ page }) => {
    await stubYouTubeApi(page, { end: true });
    await page.goto('/');
    await waitForHydration(page);

    await playLscLeche(page);

    await expect
      .poll(() => stubCalls(page))
      .toEqual(expect.arrayContaining(['seekTo(0)', 'playVideo']));
    await expect(page.locator('dialog[open]')).toBeVisible();
    await expect(page.locator('dialog[open] iframe')).toBeVisible();
  });

  test('the close button tears the player down', async ({ page }) => {
    await stubYouTubeApi(page);
    await page.goto('/');
    await waitForHydration(page);

    await playLscLeche(page);
    await expect(page.locator('dialog[open] iframe')).toBeVisible();

    await page.locator('dialog[open] button[aria-label]').first().click();

    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('dialog iframe')).toHaveCount(0);
    expect(await stubCalls(page)).toContain('destroy');
  });

  /**
   * The source can remove a video, make it private or switch embedding off at
   * any time, and nothing in this repository would change. The player then
   * loads fine and fires `onError` (100, 101 or 150) — and without handling
   * it the visitor was left on YouTube's own error screen with no way on.
   *
   * The stand-in player makes the refusal deterministic: which of the real
   * 194 videos is broken today is not something a test can know, and a suite
   * that depends on one breaking is a suite that fails when it is fixed.
   */
  test('a video YouTube refuses to play falls back to the source', async ({ page }) => {
    // 150: the owner does not allow this video to be embedded.
    await stubYouTubeApi(page, { error: 150 });

    await page.goto('/');
    await waitForHydration(page);
    await playLscLeche(page);

    const dialog = page.locator('dialog[open]');
    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('no es pot reproduir');
    await expect(alert.getByRole('link')).toHaveAttribute('href', /youtube\.com/);
    // The refused player is torn down, not left behind the message.
    await expect(dialog.locator('iframe')).toHaveCount(0);
  });

  /** The API itself never arriving — an extension or a filtered network. */
  test('a player that cannot load falls back to the source', async ({ page }) => {
    await page.route('https://www.youtube.com/iframe_api', (route) => route.abort());

    await page.goto('/');
    await waitForHydration(page);
    await playLscLeche(page);

    const alert = page.locator('dialog[open]').getByRole('alert');
    await expect(alert).toContainText('No hem pogut carregar el reproductor');
    await expect(alert.getByRole('link')).toHaveAttribute('href', /youtube\.com/);
  });

  test('an LSE sign links out to the dictionary instead of playing', async ({ page }) => {
    await page.goto('/es/');
    await waitForHydration(page);

    const link = page.locator(
      '.sign-card[data-sign-id="leche"] .sign-card__lang[data-sl="lse"] a.sign-card__cta',
    );

    await expect(link).toHaveAttribute('href', /fundacioncnse-dilse\.org/);
    await expect(link).toHaveAttribute('rel', /noreferrer/);
  });

  /**
   * A stored url the app cannot read a YouTube id from used to count a
   * play that never happened and leave the button doing nothing visible — no
   * dialog, no message, nothing a visitor or a screen reader could act on.
   * No real content hits this today (every url is validated at build and,
   * since a later fix, at export too), so it is reproduced the same way
   * `.sign-page--no-source` is: injecting the exact state rather than a
   * simulation of it.
   */
  test('a video whose url will not resolve still opens with a visible, accessible fallback', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page);

    const button = page.locator(
      '.sign-card[data-sign-id="leche"] .sign-card__lang[data-sl="lsc"] [data-action="play"]',
    );
    await button.evaluate((el) =>
      el.setAttribute('data-video-url', 'https://example.com/not-a-video'),
    );
    await button.click();

    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    // The header — title and close button — must still render: before the
    // fix, the whole dialog body was gated on the id having parsed, so this
    // case rendered nothing but an empty, unclosable-by-visible-means dialog.
    await expect(dialog.getByRole('heading', { name: 'llet' })).toBeVisible();
    await expect(dialog.locator('[aria-label]').first()).toBeVisible();

    const alert = dialog.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('no es pot reproduir');

    const sourceLink = alert.getByRole('link');
    await expect(sourceLink).toHaveAttribute('href', 'https://example.com/not-a-video');

    await expect(dialog.locator('iframe')).toHaveCount(0);
  });
});

/**
 * The header is sticky and holds the brand, the search field, a scrolling row
 * of category chips and a row of status filters — 261px of a 375px-tall
 * viewport before this. Folding the filter rows away while reading down the
 * catalogue is worth a third of the screen, so it is worth a test.
 */
test.describe('condensing toolbar', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) >= 640,
    'the toolbar only condenses on phones',
  );

  const header = '#app-header';

  test('folds the filters away on the way down and returns them on the way up', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page);

    // The attribute flips as soon as the scroll handler runs, but the rows
    // fold over a transition, so every height here is polled until it settles
    // rather than read on the next tick.
    const height = async () => (await page.locator(header).boundingBox())!.height;
    const expanded = await height();

    await page.mouse.move(180, 600);
    await page.mouse.wheel(0, 900);
    await expect(page.locator(header)).toHaveAttribute('data-condensed', 'true');

    // Worth doing at all: this should reclaim a real slice of the screen, not
    // a few pixels of padding.
    await expect.poll(async () => expanded - (await height())).toBeGreaterThan(80);

    // The search field is the one control that stays: it is the fastest route
    // to a specific sign and it costs a single row.
    await expect(page.locator('#sign-search')).toBeVisible();

    // Reversing before the fold has finished is something the implementation
    // deliberately ignores — that guard is what stops the header oscillating
    // against its own layout shift — and it is not a gesture a hand makes.
    await page.waitForTimeout(400);
    await page.mouse.wheel(0, -400);
    await expect(page.locator(header)).toHaveAttribute('data-condensed', 'false');
    await expect.poll(async () => Math.round(await height())).toBe(Math.round(expanded));
  });

  test('collapsed filters leave the tab order rather than hiding inside it', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    const categories = page
      .getByRole('group', { name: /categor/i })
      .getByRole('button')
      .first();
    await expect(categories).toBeVisible();

    await page.mouse.move(180, 600);
    await page.mouse.wheel(0, 900);
    await expect(page.locator(header)).toHaveAttribute('data-condensed', 'true');

    // Hidden means hidden: a control that is invisible but still focusable is
    // worse than one that is simply gone.
    await expect(categories).toBeHidden();
  });

  test('keeps the filters open while focus is inside the header', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    await page.locator('#sign-search').focus();
    await page.mouse.move(180, 600);
    await page.mouse.wheel(0, 900);

    // The attribute still flips — the stylesheet is what refuses to act on it
    // while focus is inside, so someone filtering by keyboard never has the
    // controls close under them.
    await expect(page.locator(header)).toHaveAttribute('data-condensed', 'true');
    await expect(page.getByRole('group', { name: /categor/i })).toBeVisible();
  });
});

/**
 * Seventeen category filters in a horizontally scrolling row showed three of
 * them on a 375px screen and hid the rest behind five screens of sideways
 * scrolling — you could not learn that "Animals" existed without swiping
 * blind. They wrap and collapse now, so the list is either short or complete,
 * never a keyhole onto itself.
 */
test.describe('category filters', () => {
  const toggle = (page: Page) => page.locator('.chip--more');

  test('collapsed, the catalogue can still be filtered once expanded', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    const animals = page.getByRole('button', { name: 'Animals', exact: true });
    await expect(animals).toBeHidden();

    await toggle(page).click();
    await expect(animals).toBeVisible();

    const before = await visibleCards(page);
    await animals.click();
    const after = await visibleCards(page);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  test('the chosen category stays on screen after the list collapses', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    await toggle(page).click();
    await page.getByRole('button', { name: 'Animals', exact: true }).click();

    // Picking one closes the list, but the filter doing the work has to remain
    // visible: otherwise the catalogue is visibly cut down with nothing on
    // screen explaining why.
    await expect(page.getByRole('button', { name: 'Animals', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Emocions', exact: true })).toBeHidden();
  });

  test('hidden categories are not rendered rather than merely invisible', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    // A control that is invisible but still focusable is worse than one that
    // is absent, so the collapsed list must not leave any behind.
    await expect(page.getByRole('button', { name: 'Emocions', exact: true })).toHaveCount(0);

    await toggle(page).click();
    await expect(page.getByRole('button', { name: 'Emocions', exact: true })).toHaveCount(1);
  });

  test('nothing scrolls sideways in either state', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    const overflows = () =>
      page.locator('.chip-row').evaluate((el) => el.scrollWidth > el.clientWidth + 1);

    expect(await overflows()).toBe(false);
    await toggle(page).click();
    expect(await overflows()).toBe(false);
  });
});

/**
 * The catalogue was already grouped — the curated route, then one category
 * after another — but nothing said so: thirty-two food words went by with no
 * indication of where they ended.
 */
test.describe('grid sections', () => {
  const sections = (page: Page) => page.locator('[data-section]:not([hidden])');

  test('every run of signs is introduced by a heading', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    // The curated route plus one per category.
    await expect(sections(page)).toHaveCount(16);
    await expect(sections(page).first().getByRole('heading')).toHaveText('Primers signes');
  });

  test('a search keeps its results grouped by where they came from', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    await page.getByPlaceholder(/cerca un signe/i).fill('gos');

    // Not a flat run of matches, and not a wall of empty headings either.
    await expect(sections(page)).toHaveCount(1);
    await expect(sections(page).getByRole('heading')).toHaveText('Animals');
  });

  test('headings do not survive a filter that empties them', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    await page.getByPlaceholder(/cerca un signe/i).fill('zzzzzz');

    await expect(sections(page)).toHaveCount(0);
  });

  test('the heading levels stay in order', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    // A card belongs to a section rather than sitting beside it, so the words
    // are a level below the headings that introduce them.
    const levels = await page.evaluate(() =>
      [...document.querySelectorAll('h1, h2, h3')].map((el) => el.tagName),
    );
    expect(levels[0]).toBe('H1');
    expect(levels[1]).toBe('H2');
    expect(levels).toContain('H3');
    expect(levels).not.toContain('H4');
  });

  /**
   * The home reached no category page at all — fifteen pages a reader could
   * only find through a sign's breadcrumb. The link says where it goes in
   * full to a screen reader and a crawler, and starts with the words on
   * screen, so voice control can say what it sees (WCAG 2.5.3).
   */
  test('each category heading leads to its category page', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('.grid-section__all');
    await expect(links).toHaveCount(15);

    const animals = page.locator('[data-section="animals"] .grid-section__all');
    await expect(animals).toHaveAttribute('href', '/categoria/animals/');
    await expect(animals).toHaveAccessibleName(/^Veure els \d+ signes d’animals$/);
    expect((await animals.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // The curated route is not a category and has no page to lead to.
    await expect(page.locator('[data-section="first-signs"] a')).toHaveCount(0);
  });

  /**
   * A number next to a link is a promise about the page behind it. It counts
   * what the category page shows — first signs included, though on the home
   * they sit under their own heading — so it is checked against that page.
   */
  test('the count on the link is the count on the page it leads to', async ({ page }) => {
    await page.goto('/es/');

    const link = page.locator('[data-section="animals"] .grid-section__all');
    await expect(link).toHaveAttribute('href', '/es/categoria/animals/');
    const name = await link.evaluate((el) => el.textContent ?? '');
    const promised = Number(name.match(/\d+/)?.[0]);

    await link.click();
    await expect(page).toHaveURL(/\/es\/categoria\/animals\/$/);
    await expect(page.locator('.sign-card')).toHaveCount(promised);
  });
});

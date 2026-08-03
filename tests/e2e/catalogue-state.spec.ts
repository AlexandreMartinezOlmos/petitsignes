import { expect, test, type Page } from '@playwright/test';

/**
 * The catalogue remembers what it was showing.
 *
 * Until every sign had its own page nobody ever left the catalogue, so filters
 * held purely in memory cost nothing. The moment the word on a card became a
 * link, going back landed on an unfiltered grid — the bug had been there all
 * along, the detail page only made it reachable.
 *
 * The state rides in `history.state` rather than in the URL, and that is a
 * privacy decision, not a stylistic one: GoatCounter's script sends
 * `location.search` on every hit through a field no setting can switch off, so a
 * `?q=` would publish what a parent typed into the search box. §2.2 promises
 * that never happens. `the address bar never learns what someone searched for`
 * below is what keeps it true.
 */

const SEARCH = 'llet';
/**
 * Fuse's fuzzy threshold matches 12 signs against "llet", not only the ones
 * whose label contains it literally (`galeta`, `aplaudir (llengua de signes)`)
 * — well under 194 either way.
 */
const EXPECTED_MATCHES = 12;

/**
 * The module coalesces history writes for 300ms, because Safari refuses more
 * than ~100 in 30 seconds and typing is one change per keystroke. A real visitor
 * spends far longer than this reading the grid before tapping a card; a test has
 * to wait it out explicitly.
 */
const WRITE_DELAY_MS = 300;

async function search(page: Page, term: string): Promise<void> {
  await page.getByRole('searchbox').fill(term);
  await expect(page.locator('.sign-card:not([hidden])')).toHaveCount(EXPECTED_MATCHES);
  await page.waitForTimeout(WRITE_DELAY_MS + 100);
}

function visibleCards(page: Page) {
  return page.locator('.sign-card:not([hidden])');
}

test.describe('coming back to the catalogue', () => {
  test('the search survives opening a sign and pressing back', async ({ page }) => {
    await page.goto('/');
    await search(page, SEARCH);

    await page.locator('.sign-card[data-sign-id="leche"] .sign-card__link').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(SEARCH);

    await page.goBack();

    await expect(page.getByRole('searchbox')).toHaveValue(SEARCH);
    await expect(visibleCards(page)).toHaveCount(EXPECTED_MATCHES);
  });

  test('a reload keeps the filters too', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('searchbox').fill(SEARCH);
    await page.locator('.chip-quiet', { hasText: 'Pendents' }).click();
    await page.waitForTimeout(WRITE_DELAY_MS + 100);

    await page.reload();

    await expect(page.getByRole('searchbox')).toHaveValue(SEARCH);
    await expect(page.locator('.chip-quiet', { hasText: 'Pendents' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('a category chip comes back pressed, not just applied', async ({ page }) => {
    await page.goto('/');

    await page.locator('.chip--more').click();
    await page.locator('.toolbar__categories .chip', { hasText: 'Animals' }).first().click();
    const filtered = await visibleCards(page).count();
    expect(filtered).toBeLessThan(194);
    await page.waitForTimeout(WRITE_DELAY_MS + 100);

    await page.reload();

    // Collapsed, the list still shows whichever category is filtering — so the
    // chip has to be both present and pressed, not merely remembered in a store.
    const chip = page.locator('.toolbar__categories .chip', { hasText: 'Animals' }).first();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(visibleCards(page)).toHaveCount(filtered);
  });

  /** A first visit is not a restored one: nothing is remembered that was never set. */
  test('arriving fresh shows the whole catalogue', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(visibleCards(page)).toHaveCount(194);
  });

  /**
   * The whole catalogue is never shown to someone who is coming back to a
   * filtered one.
   *
   * The grid is static HTML with all 194 cards visible and the controller hides
   * the excluded ones once its module runs, so restoring a search meant painting
   * the wrong answer first. Measured on the built site before the fix: two frames
   * at full CPU, and with the CPU throttled 20× — a cheap Android, the device
   * this is built for — the full catalogue held for several frames before
   * collapsing to the matches.
   *
   * Sampling every animation frame from before the page's own scripts run is the
   * only way to see this; by the time any assertion could run, it is over.
   */
  test('never paints the unfiltered grid on the way back', async ({ page }) => {
    await page.addInitScript(() => {
      const seen: number[] = [];
      (window as unknown as { __frames: number[] }).__frames = seen;

      const sample = () => {
        const grid = document.getElementById('sign-grid');
        const cards = document.querySelectorAll<HTMLElement>('.sign-card');
        if (cards.length > 0) {
          // What a person could see. A grid held back by `visibility` shows
          // nothing, however many cards are un-hidden inside it.
          const shown = grid !== null && getComputedStyle(grid).visibility !== 'hidden';
          let visible = 0;
          if (shown) for (const card of cards) if (!card.hidden) visible++;
          seen.push(visible);
        }
        if (seen.length < 120) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    await page.goto('/');
    await search(page, SEARCH);

    await page.reload();
    await expect(visibleCards(page)).toHaveCount(EXPECTED_MATCHES);

    const frames = await page.evaluate(
      () => (window as unknown as { __frames: number[] }).__frames,
    );

    // Only ever nothing, then the right answer.
    expect([...new Set(frames)].sort((a, b) => a - b)).toEqual([0, EXPECTED_MATCHES]);
  });
});

test.describe('what the filters must never touch', () => {
  /**
   * The §2.2 guard, and the reason this feature is not a query string.
   *
   * GoatCounter's `count.js` builds `q: location.search` straight from the
   * location and sends it on every hit. `q` is not in the set of settings it
   * honours (`no_onload`, `no_events`, `allow_local`, `allow_frame`, `path`,
   * `title`, `referrer`, `event`), and its `get_path()` appends the search a
   * second time. So the moment a filter reaches the address bar, the site is
   * publishing what a parent typed — no matter what else is configured.
   *
   * This asserts the one property that makes that impossible by construction.
   */
  test('the address bar never learns what someone searched for', async ({ page }) => {
    await page.goto('/');
    await search(page, SEARCH);

    await page.locator('.chip--more').click();
    await page.locator('.toolbar__categories .chip', { hasText: 'Animals' }).first().click();
    await page.locator('.chip-quiet', { hasText: 'Preferits' }).click();
    await page.waitForTimeout(WRITE_DELAY_MS + 100);

    const url = new URL(page.url());
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
    expect(page.url()).not.toContain(SEARCH);

    // And the state really is being kept — otherwise this test would pass on a
    // build where the feature had simply been deleted.
    const stored = await page.evaluate(() => window.history.state);
    expect(JSON.stringify(stored)).toContain(SEARCH);
  });

  /**
   * Only `replaceState`, never `pushState`. With no URL to change, a pushed entry
   * would leave the back button visibly doing nothing while the grid rearranged,
   * and someone who touched five chips would need six presses to leave.
   */
  test('filtering does not fill the back button with steps', async ({ page }) => {
    await page.goto('/');
    const before = await page.evaluate(() => window.history.length);

    await search(page, SEARCH);
    await page.locator('.chip-quiet', { hasText: 'Apresos' }).click();
    await page.locator('.chip-quiet', { hasText: 'Tots' }).click();
    await page.waitForTimeout(WRITE_DELAY_MS + 100);

    expect(await page.evaluate(() => window.history.length)).toBe(before);
  });

  /**
   * An in-page anchor pushes a fresh entry with a null state. Without the
   * `hashchange` write, filtering and then using the skip link would leave the
   * filters on the previous entry only — and opening a sign from there and
   * coming back would land on the empty one.
   */
  test('using the skip link does not cost the filters', async ({ page }) => {
    await page.goto('/');
    await search(page, SEARCH);

    await page.evaluate(() => {
      document.querySelector<HTMLAnchorElement>('.skip-link')?.click();
    });
    await expect.poll(() => new URL(page.url()).hash).toBe('#main');

    await page.locator('.sign-card[data-sign-id="leche"] .sign-card__link').click();
    await page.goBack();

    await expect(page.getByRole('searchbox')).toHaveValue(SEARCH);
    await expect(visibleCards(page)).toHaveCount(EXPECTED_MATCHES);
  });
});

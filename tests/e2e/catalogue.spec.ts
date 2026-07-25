import { expect, test, type Page } from '@playwright/test';

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
    expect(await visibleCards(page)).toBeGreaterThan(200);
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

  test('category chips narrow the grid', async ({ page }) => {
    const before = await visibleCards(page);
    await page.getByRole('button', { name: 'Animals', exact: true }).click();

    const after = await visibleCards(page);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  test('favourites survive a reload', async ({ page }) => {
    const card = page.locator('.sign-card[data-sign-id="leche"]');
    await card.getByRole('button', { name: /afegeix a preferits/i }).click();

    await expect(card.locator('[data-action="favorite"]')).toHaveAttribute('aria-pressed', 'true');

    await page.reload();

    await expect(
      page.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]'),
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
    // Only the logo and the two language links live in the header.
    await expect(page.getByRole('link', { name: 'Catàleg' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Primers signes' })).toHaveCount(0);
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
  // player, LSE only links out (docs/permisos/).
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

    await playLscLeche(page);

    const iframe = page.locator('dialog[open] iframe');
    await expect(iframe).toHaveAttribute('src', /youtube-nocookie\.com/);
  });

  test('a finished sign does not close the player on its own', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    await playLscLeche(page);
    await expect(page.locator('dialog[open]')).toBeVisible();

    // The clips are a few seconds long and loop; the dialog must still be open
    // well past a single play-through (regression: it used to close itself).
    await page.waitForTimeout(7000);

    await expect(page.locator('dialog[open]')).toBeVisible();
    await expect(page.locator('dialog[open] iframe')).toBeVisible();
  });

  test('the close button tears the player down', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    await playLscLeche(page);
    await expect(page.locator('dialog[open] iframe')).toBeVisible();

    await page.locator('dialog[open] button[aria-label]').first().click();

    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('dialog iframe')).toHaveCount(0);
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
});

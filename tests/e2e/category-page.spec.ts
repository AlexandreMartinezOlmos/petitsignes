import { expect, test, type Page } from '@playwright/test';

/**
 * One page per category.
 *
 * The step that was missing between a catalogue of 194 concepts at one address
 * and 194 addresses with one concept each. "Signes de menjar per a nadons" is as
 * ordinary a search as "com es signa llet", and nothing answered it.
 *
 * They are also what makes the catalogue walkable: a sign links up to its
 * category, a category links across to the other fourteen, so a crawler that
 * lands on any entry can reach the rest without returning to the index.
 *
 * The slug is Catalan in both locales, like `/el-projecte/`. The ids are English
 * because they are code; an address is not code.
 */

const CA = '/categoria/menjar-i-beure/';
const ES = '/es/categoria/menjar-i-beure/';

function visibleCards(page: Page) {
  return page.locator('.sign-card');
}

test.describe('finding a category page', () => {
  /** The route that makes these reachable by a person, not only by a crawler. */
  test('the breadcrumb on a sign leads to its category', async ({ page }) => {
    await page.goto('/signe/leche/');

    const crumb = page.locator('.breadcrumb__link', { hasText: 'Menjar i beure' });
    await expect(crumb).toHaveAttribute('href', CA);

    await crumb.click();
    await expect(page).toHaveURL(new RegExp(`${CA}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Signes de Menjar i beure');
  });

  test('a sign offers the rest of its category, not the whole catalogue', async ({ page }) => {
    await page.goto('/signe/leche/');

    const all = page.locator('.sign-related__all');
    await expect(all).toHaveAttribute('href', CA);
    // The number in the link is counted from the data, so it has to agree with
    // the page it points at.
    const text = (await all.textContent()) ?? '';
    const claimed = Number(text.match(/\d+/)?.[0]);

    await all.click();
    await expect(visibleCards(page)).toHaveCount(claimed);
  });

  test('the sitemap lists every category, in both languages', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).toContain(`<loc>https://petitsignes.cat${CA}</loc>`);
    expect(xml).toContain(`<loc>https://petitsignes.cat${ES}</loc>`);
    expect((xml.match(/<loc>[^<]*\/categoria\//g) ?? []).length).toBe(30);
  });
});

test.describe('what a category page holds', () => {
  test('shows every sign of that category and nothing else', async ({ page }) => {
    await page.goto(CA);

    const cards = visibleCards(page);
    await expect(cards).not.toHaveCount(0);

    const categories = await cards.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.category),
    );
    expect([...new Set(categories)]).toEqual(['food']);
  });

  /** A lead claiming thirty signs above twenty-nine cards is a small lie nobody checks. */
  test('the count in the lead is the number of cards below it', async ({ page }) => {
    await page.goto(CA);

    const lead = (await page.locator('.category-hero__lead').textContent()) ?? '';
    const claimed = Number(lead.match(/\d+/)?.[0]);

    expect(claimed).toBeGreaterThan(0);
    await expect(visibleCards(page)).toHaveCount(claimed);
  });

  /**
   * §4.4, the invariant that makes §2.1 structural: the other language's gesture
   * must not be in the document at all, one `display` away from being shown.
   */
  test('ships only the sign language its URL promises', async ({ request }) => {
    const catalan = await (await request.get(CA)).text();
    expect(catalan).toContain('Llengua de Signes Catalana');
    expect(catalan).not.toContain('fundacioncnse-dilse.org');

    const spanish = await (await request.get(ES)).text();
    expect(spanish).toContain('Lengua de Signos Española');
    expect(spanish).toContain('fundacioncnse-dilse.org');
  });

  test('describes itself to search engines and declares its translation', async ({ request }) => {
    const html = await (await request.get(CA)).text();

    expect(html).toMatch(/<meta name="description" content="[^"]*Menjar i beure/);
    expect(html).toContain(`<link rel="canonical" href="https://petitsignes.cat${CA}"`);
    expect(html).toContain(`hreflang="es" href="https://petitsignes.cat${ES}"`);
  });

  test('is a junction: the other fourteen categories, and never itself', async ({ page }) => {
    await page.goto(CA);

    const hrefs = await page
      .locator('.category-others__link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

    expect(hrefs).toHaveLength(14);
    expect(hrefs.every((href) => /^\/categoria\/[a-z0-9-]+\/$/.test(href ?? ''))).toBe(true);
    expect(hrefs).not.toContain(CA);
  });

  test('the Spanish page keeps the Catalan slug and links to Spanish siblings', async ({
    page,
  }) => {
    await page.goto(ES);

    const hrefs = await page
      .locator('.category-others__link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

    expect(hrefs.every((href) => (href ?? '').startsWith('/es/categoria/'))).toBe(true);
  });
});

test.describe('a category page is not a dead list', () => {
  test('favouriting here shows up in the catalogue', async ({ page }) => {
    await page.goto(CA);

    const favorite = page.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]');
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/');
    await expect(
      page.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  /** §4.3: a list of cards never contacts YouTube until a sign is asked for. */
  test('does not contact YouTube until a sign is asked for', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (request) => {
      const host = new URL(request.url()).hostname;
      if (host.endsWith('youtube.com') || host.endsWith('ytimg.com')) hits.push(host);
    });

    await page.goto(CA);
    await page.waitForLoadState('networkidle');
    expect(hits).toEqual([]);

    await page.locator('.sign-card__cta[data-action="play"]').first().click();
    await expect(page.locator('dialog.player-dialog')).toBeVisible();
    await expect.poll(() => hits.length).toBeGreaterThan(0);
  });
});

test.describe('a category page on a phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  /** WCAG 1.4.10. Fifteen category chips are the thing most likely to overflow. */
  test('does not scroll sideways at 320px', async ({ page }) => {
    await page.goto(CA);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

import { expect, test, type Page } from '@playwright/test';

/**
 * What a page makes a visitor download, read from the bytes the browser
 * actually receives rather than from the build's own report of itself.
 *
 * These guard what regresses without anyone seeing it: a single import is
 * enough to pull a whole module into every page, and the page keeps working,
 * so nothing but the bytes shows it.
 */

/** Every script the page loads, after its islands have hydrated. */
async function scriptsOf(page: Page, path: string): Promise<string[]> {
  const bodies: Promise<string>[] = [];
  page.on('response', (response) => {
    if (response.url().endsWith('.js')) bodies.push(response.text());
  });

  await page.goto(path);
  // `client:visible` islands (the project page's progress controls) load only
  // once on screen, so bring those into view before waiting on them.
  for (const island of await page.locator('astro-island[client="visible"]').all()) {
    await island.scrollIntoViewIfNeeded();
  }
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  return Promise.all(bodies);
}

/**
 * The search engine is the heaviest thing the site ships after React, and only
 * the catalogue has a search box. The card wiring the other pages need used
 * to live next to the grid controller, which imports the search index, so a
 * sign page downloaded the engine to wire two toggles and a play button.
 *
 * The marker is one of Fuse's own error messages; the catalogue check keeps
 * it honest, since a marker that stopped appearing there would make the rest
 * pass for the wrong reason.
 */
const FUSE_MARKER = "Incorrect 'index' type";

test('the catalogue, which has a search box, loads the search engine', async ({ page }) => {
  const scripts = await scriptsOf(page, '/');
  expect(scripts.some((body) => body.includes(FUSE_MARKER))).toBe(true);
});

for (const { name, path } of [
  { name: 'sign page', path: '/signe/leche/' },
  { name: 'category page', path: '/categoria/animals/' },
  { name: 'not-found page', path: '/404.html' },
]) {
  test(`the ${name}, which has no search box, does not load the search engine`, async ({
    page,
  }) => {
    const scripts = await scriptsOf(page, path);
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.some((body) => body.includes(FUSE_MARKER))).toBe(false);
  });
}

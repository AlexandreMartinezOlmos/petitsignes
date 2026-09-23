import { expect, test, type Page } from '@playwright/test';
import { MESSAGES } from '../../src/lib/i18n.ts';
import { LANGUAGES, type Language } from '../../src/lib/types.ts';

/**
 * What a page makes a visitor download, read from the bytes the browser
 * actually receives rather than from the build's own report of itself.
 *
 * Both checks below guard something that regressed without anyone seeing it:
 * a single import is enough to pull a whole module into every page, and the
 * page keeps working, so nothing but the bytes shows it.
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

const PAGES: { name: string; path: string; language: Language }[] = [
  { name: 'catalogue', path: '/', language: 'ca' },
  { name: 'catalogue', path: '/es/', language: 'es' },
  { name: 'sign page', path: '/signe/leche/', language: 'ca' },
  { name: 'sign page', path: '/es/signe/leche/', language: 'es' },
  { name: 'category', path: '/categoria/animals/', language: 'ca' },
  { name: 'project page', path: '/el-projecte/', language: 'ca' },
  { name: 'project page', path: '/es/el-projecte/', language: 'es' },
];

/**
 * Interface text that only another language uses. Short strings are left out
 * ("LSC", "Instagram"…): they are shared by several languages, or common
 * enough to turn up in any minified code.
 */
function foreignStrings(language: Language): string[] {
  const own = new Set<string>(Object.values(MESSAGES[language]));
  return LANGUAGES.filter((other) => other !== language).flatMap((other) =>
    Object.values(MESSAGES[other]).filter((text) => text.length >= 16 && !own.has(text)),
  );
}

/**
 * An island that imports the interface dictionaries ships all of them: a
 * Catalan page used to download the Spanish and English interface, about
 * 6 kB compressed, as code it would never run. Islands now receive their own
 * strings from the page instead (`src/lib/translate.ts`).
 */
for (const { name, path, language } of PAGES) {
  test(`the ${name} (${language}) downloads no interface text in another language`, async ({
    page,
  }) => {
    const scripts = await scriptsOf(page, path);
    expect(scripts.length).toBeGreaterThan(0);

    const leaked = foreignStrings(language).filter((text) =>
      scripts.some((body) => body.includes(text)),
    );
    expect(leaked).toEqual([]);
  });
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

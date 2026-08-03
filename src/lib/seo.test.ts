import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_PATHS, buildRobots, buildSitemap } from './seo.ts';
import { ROUTED_LOCALES, localeHref } from './routing.ts';
import { SITE_ORIGIN } from './site.ts';

/**
 * Nothing here is visible to a visitor, which is why it is worth asserting.
 * A sitemap that lost a page, or a preview deployment that invited crawlers,
 * both fail without an error — the cost shows up later in someone else's index.
 */

const PREVIEW = 'https://feature-x.petitsignes.pages.dev';

describe('sitemap', () => {
  const xml = buildSitemap();

  it('lists every published page in every language', () => {
    for (const path of SITE_PATHS) {
      for (const locale of ROUTED_LOCALES) {
        const href = new URL(localeHref(path, locale), SITE_ORIGIN).href;
        expect(xml, `${path} in ${locale}`).toContain(`<loc>${href}</loc>`);
      }
    }
    expect(xml.match(/<loc>/g)).toHaveLength(SITE_PATHS.length * ROUTED_LOCALES.length);
  });

  /**
   * The site publishes the same catalogue twice. Without alternates the two
   * locales compete as duplicates instead of reading as one page in two
   * languages, which is the entire reason this file carries the xhtml
   * namespace rather than being a flat list of URLs.
   */
  it('declares the translations of each URL, including x-default', () => {
    for (const locale of ROUTED_LOCALES) {
      expect(xml).toContain(`hreflang="${locale}"`);
    }
    expect(xml).toContain('hreflang="x-default"');

    const perUrl = ROUTED_LOCALES.length + 1;
    expect(xml.match(/xhtml:link/g)).toHaveLength(
      SITE_PATHS.length * ROUTED_LOCALES.length * perUrl,
    );
  });

  it('points x-default at the bare path, which is what / serves', () => {
    expect(xml).toContain(`hreflang="x-default" href="${SITE_ORIGIN}/"`);
    expect(xml).not.toContain(`hreflang="x-default" href="${SITE_ORIGIN}/es/"`);
  });

  it('emits only absolute URLs on the origin it was given', () => {
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) expect(loc.startsWith(`${SITE_ORIGIN}/`)).toBe(true);

    const preview = buildSitemap(PREVIEW);
    expect(preview).toContain(`<loc>${PREVIEW}/</loc>`);
    expect(preview).not.toContain(SITE_ORIGIN);
  });

  it('stays well-formed when a path carries XML-significant characters', () => {
    const xmlWithAmp = buildSitemap(SITE_ORIGIN, ['/a&b/']);
    expect(xmlWithAmp).toContain('&amp;');
    expect(xmlWithAmp).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });
});

/**
 * The sitemap test above builds its expectation from `SITE_PATHS` and checks
 * `SITE_PATHS` against it — it would pass just as well if a page were added to
 * `src/pages/` and never added here. This reads the actual files off disk, the
 * same way `signs.test.ts` reads real ids, so the two lists are compared
 * against something neither of them generated.
 */
describe('SITE_PATHS matches the static pages on disk', () => {
  const dir = resolve(process.cwd(), 'src/pages');
  const staticPages = readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith('.astro') && entry.name !== '404.astro',
    )
    .map((entry) => entry.name.replace(/\.astro$/, ''))
    .map((name) => (name === 'index' ? '/' : `/${name}/`));

  it('lists every top-level static page and nothing else', () => {
    // `404.astro` is excluded on purpose (an error page, not a published
    // route); `categoria/[slug].astro` and `signe/[id].astro` are excluded
    // because they are dynamic — their paths come from the content
    // collections, not this list (see `sitemap.xml.ts`).
    expect([...staticPages].sort()).toEqual([...SITE_PATHS].sort());
  });
});

describe('robots.txt', () => {
  it('invites crawlers on the canonical domain and points at the sitemap', () => {
    const robots = buildRobots();
    expect(robots).toContain('Allow: /');
    expect(robots).not.toContain('Disallow: /');
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });

  /**
   * Every branch deploys the same build to its own pages.dev origin. Those are
   * for looking at, not for reading in search results — an indexed preview
   * competes with production for identical content.
   */
  it('shuts crawlers out of anything that is not the canonical domain', () => {
    const robots = buildRobots(PREVIEW);
    expect(robots).toContain('Disallow: /');
    expect(robots).not.toContain('Allow: /');
    expect(robots).not.toContain('Sitemap:');
  });
});

/**
 * The guard is only as good as the origin it is handed, and the first version
 * of this shipped with it inert: nothing set `SITE_URL` on a Cloudflare build,
 * so previews declared the canonical domain and served `Allow: /`. The origin
 * now comes from `CF_PAGES_BRANCH`/`CF_PAGES_URL` when Cloudflare provides
 * them, and these cases are what that has to keep true.
 */
describe('the origin a deployment describes itself with', () => {
  it.each([
    ['a branch preview', PREVIEW, true],
    ['production', SITE_ORIGIN, false],
  ])('%s', (_name, origin, blocked) => {
    expect(buildRobots(origin).includes('Disallow: /')).toBe(blocked);
    expect(buildSitemap(origin)).toContain(`<loc>${origin}/</loc>`);
  });
});

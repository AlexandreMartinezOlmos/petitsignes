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

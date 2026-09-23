import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PREVIEW_NOINDEX,
  SITE_PATHS,
  TITLE_MAX_LENGTH,
  breadcrumbJsonLd,
  buildRobots,
  buildSitemap,
  documentTitle,
  markPreviewHeaders,
  serializeJsonLd,
  websiteJsonLd,
} from './seo.ts';
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

  /**
   * The data has no date that means "this page changed" — `updatedAt` is when
   * a source was checked — and a `lastmod` that does not track real changes
   * teaches search engines to ignore the field for the whole site. See the
   * comment on `buildSitemap` before adding one.
   */
  it('claims no modification date it could not back up', () => {
    expect(xml).not.toContain('<lastmod>');
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
   *
   * This asserted `Disallow: /` until that turned out to be the one setting
   * that defeats the guard: a crawler that may not fetch a page never reads
   * its `noindex`, and the bare address can still be listed when someone links
   * to it. A preview now lets crawlers in to be told, and advertises nothing.
   */
  it('lets crawlers into a preview so they can read that it is not to be indexed', () => {
    const robots = buildRobots(PREVIEW);
    expect(robots).toContain('Allow: /');
    expect(robots).not.toContain('Disallow: /');
    expect(robots).not.toContain('Sitemap:');
    expect(markPreviewHeaders('', PREVIEW)).toContain(PREVIEW_NOINDEX);
  });

  /**
   * The guard this file was missing, and it cost a red build to find out.
   *
   * A `Content-Signal:` line was added here to state the mining reservation, on
   * the reasonable-looking grounds that Cloudflare's managed robots.txt states
   * it the same way. It is not part of the robots.txt grammar: Lighthouse's
   * validator reported "Unknown directive", marked the whole file invalid, and
   * took the SEO score from 1.00 to 0.92 on all twelve audited pages — three
   * points below the budget, so the build failed for a file no test looked at.
   *
   * Anything genuinely non-standard belongs in a format built for it. The
   * reservation now lives in `.well-known/tdmrep.json` and a `tdm-reservation`
   * header, and this keeps the next well-meant directive out.
   */
  it('uses only directives a robots.txt parser understands', () => {
    const known = ['user-agent', 'allow', 'disallow', 'sitemap', 'crawl-delay', 'host'];

    for (const origin of [SITE_ORIGIN, PREVIEW]) {
      const directives = buildRobots(origin)
        .split('\n')
        .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
        .map((line) => line.split(':')[0]?.trim().toLowerCase());

      for (const directive of directives) {
        expect(known, `"${directive}" in robots.txt for ${origin}`).toContain(directive);
      }
    }
  });

  /**
   * `robots.txt` is where someone looks first to find out what they may do with
   * a site, so it says where the answer is. A comment, deliberately: it informs
   * a reader without claiming to be the machine-readable reservation, which is
   * served as a header and a well-known file instead.
   */
  it('points readers at the mining reservation without pretending to be one', () => {
    const robots = buildRobots();
    const pointer = robots.split('\n').find((line) => line.includes('/.well-known/tdmrep.json'));

    expect(pointer).toBeDefined();
    expect(pointer?.trimStart().startsWith('#')).toBe(true);
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
  ])('%s', (_name, origin, preview) => {
    expect(markPreviewHeaders('/*\n  X: y\n', origin).includes(PREVIEW_NOINDEX)).toBe(preview);
    expect(buildRobots(origin).includes('Sitemap:')).toBe(!preview);
    expect(buildSitemap(origin)).toContain(`<loc>${origin}/</loc>`);
  });
});

describe('markPreviewHeaders', () => {
  const HEADERS = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');

  /**
   * The failure this exists to make impossible costs the whole site: one
   * `noindex` on the canonical domain and every page leaves search on the next
   * crawl, with nothing on screen to say so. Byte for byte, not "contains no
   * noindex", so nothing else can creep into production through here either.
   */
  it('gives production its headers back exactly as they were', () => {
    expect(markPreviewHeaders(HEADERS, SITE_ORIGIN)).toBe(HEADERS);
  });

  it('adds noindex for every path of a preview, and keeps everything else', () => {
    const marked = markPreviewHeaders(HEADERS, PREVIEW);

    expect(marked.startsWith(HEADERS.trimEnd())).toBe(true);
    expect(marked).toMatch(new RegExp(`^/\\*\\n  ${PREVIEW_NOINDEX}$`, 'm'));
    expect(marked).toContain(PREVIEW);
  });
});

describe('documentTitle', () => {
  const NAME = 'Petits Signes';
  const SUFFIX = ` · ${NAME}`.length;

  it('appends the site name when it fits', () => {
    expect(documentTitle('«llet» en llengua de signes catalana (LSC)', NAME)).toBe(
      '«llet» en llengua de signes catalana (LSC) · Petits Signes',
    );
  });

  /**
   * The name is the part worth losing. Kept on a long title it pushes the end
   * of the sentence past the ellipsis — and on these pages the end is the name
   * of the sign language, which is the half of the query that matters.
   */
  it('drops the site name rather than letting it push the title past the cut', () => {
    const long = '«una altra vegada» en llengua de signes catalana (LSC)';
    expect(documentTitle(long, NAME)).toBe(long);
  });

  it('keeps the name at exactly the limit and drops it one character past', () => {
    const fits = 'x'.repeat(TITLE_MAX_LENGTH - SUFFIX);
    expect(documentTitle(fits, NAME)).toHaveLength(TITLE_MAX_LENGTH);
    expect(documentTitle(`${fits}x`, NAME)).toBe(`${fits}x`);
  });

  /**
   * An astral character is two UTF-16 units and one character to a reader.
   * Counting code points keeps the rule about what is seen rather than about
   * how JavaScript happens to store it.
   */
  it('counts characters as a reader does, not UTF-16 units', () => {
    const astral = '𝒶'.repeat(TITLE_MAX_LENGTH - SUFFIX);
    expect(documentTitle(astral, NAME)).toBe(`${astral} · ${NAME}`);
  });

  it('falls back to the site name for a page that has no title of its own', () => {
    expect(documentTitle(undefined, NAME)).toBe(NAME);
  });
});

describe('structured data', () => {
  it('describes each locale’s home as the site, at its own address and in its own language', () => {
    expect(websiteJsonLd('Petits Signes', '/es/', 'es')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Petits Signes',
      url: `${SITE_ORIGIN}/es/`,
      inLanguage: 'es',
    });
  });

  /**
   * Positions are 1-based and in reading order, and every item is an absolute
   * URL: a search engine resolves nothing against the page it found this on.
   */
  it('turns a trail into a numbered list of absolute URLs, in order', () => {
    const list = breadcrumbJsonLd([
      { name: 'Catálogo', href: '/es/' },
      { name: 'Animales', href: '/es/categoria/animals/' },
    ]);

    expect(list['@type']).toBe('BreadcrumbList');
    expect(list.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Catálogo', item: `${SITE_ORIGIN}/es/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Animales',
        item: `${SITE_ORIGIN}/es/categoria/animals/`,
      },
    ]);
  });

  it('describes a preview as the preview, like the canonical link does', () => {
    expect(websiteJsonLd('x', '/', 'ca', PREVIEW).url).toBe(`${PREVIEW}/`);
    expect(JSON.stringify(breadcrumbJsonLd([{ name: 'x', href: '/' }], PREVIEW))).not.toContain(
      SITE_ORIGIN,
    );
  });

  /**
   * The HTML parser decides where a script ends, and it does not know JSON:
   * a label containing `</script>` would close the block and spill the rest
   * into the page as markup. Escaped, it is the same string to a JSON reader.
   */
  it('cannot be closed early by the text it carries', () => {
    const data = { name: 'a</script><script>alert(1)</script>' };
    const body = serializeJsonLd(data);

    expect(body).not.toContain('</script');
    expect(body).not.toContain('<');
    expect(JSON.parse(body)).toEqual(data);
  });
});

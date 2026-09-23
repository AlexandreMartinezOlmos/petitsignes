import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { sourceHash } from '../../src/lib/csp.ts';
import { SITE_ORIGIN } from '../../src/lib/site.ts';

/**
 * The schema.org data each page hands to search engines, read from the build.
 *
 * Structured data is only worth having if it tells the truth about the page:
 * a breadcrumb that names a step the reader cannot see, or an entity type the
 * page does not really contain, is the thing search engines penalise — and
 * none of it is visible, so nothing but a test notices it going wrong. Read
 * off disk for the same reason as `seo.spec.ts`: it is static, and every page
 * can be checked at once.
 */

const DIST = resolve(process.cwd(), 'dist');

interface ListItem {
  position: number;
  name: string;
  item: string;
}

interface Built {
  path: string;
  html: string;
  noindex: boolean;
  /** The raw body of every JSON-LD block, as the CSP step would see it. */
  blocks: string[];
  data: Array<Record<string, unknown>>;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

/** Astro escapes these in text; the breadcrumb labels can carry an apostrophe. */
function decode(value: string): string {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

const PAGES: Built[] = htmlFiles(DIST).map((file) => {
  const html = readFileSync(file, 'utf8');
  const blocks = [
    ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ].map((match) => match[1] ?? '');

  return {
    path: `/${relative(DIST, file).split(sep).join('/')}`.replace(/index\.html$/, ''),
    html,
    noindex: /<meta name="robots" content="noindex/.test(html),
    blocks,
    data: blocks.map((body) => JSON.parse(body) as Record<string, unknown>),
  };
});

const INDEXABLE = PAGES.filter((p) => !p.noindex);

/** The breadcrumb as a reader sees it: names in order, and where each one links. */
function visibleTrail(html: string): Array<{ name: string; href: string | null }> | null {
  const nav = html.match(/<nav class="breadcrumb"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  if (nav === undefined) return null;

  return [
    ...nav.matchAll(
      /<a class="breadcrumb__link" href="([^"]*)"[^>]*>([\s\S]*?)<\/a>|<span class="breadcrumb__current"[^>]*>([\s\S]*?)<\/span>/g,
    ),
  ].map((match) =>
    match[1] !== undefined
      ? { name: decode(match[2] ?? ''), href: match[1] }
      : { name: decode(match[3] ?? ''), href: null },
  );
}

const ofType = (page: Built, type: string) => page.data.filter((d) => d['@type'] === type);

test.skip(({ isMobile }) => isMobile, 'the files on disk do not depend on the viewport');

test('the build is the one this spec expects', () => {
  expect(INDEXABLE.length).toBeGreaterThan(400);
});

test('each home page describes the site, at its own address and in its own language', () => {
  for (const [path, language] of [
    ['/', 'ca'],
    ['/es/', 'es'],
  ] as const) {
    const home = PAGES.find((p) => p.path === path)!;
    expect(ofType(home, 'WebSite'), path).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Petits Signes',
        url: `${SITE_ORIGIN}${path}`,
        inLanguage: language,
      },
    ]);
  }

  // Only the homes: a `WebSite` on every page would be 428 claims to be the
  // entry point of the site.
  const elsewhere = INDEXABLE.filter((p) => ofType(p, 'WebSite').length > 0).map((p) => p.path);
  expect(elsewhere.sort()).toEqual(['/', '/es/']);
});

/**
 * The claim structured data is allowed to make: exactly what the page shows.
 * Names in the same order as the visible breadcrumb, each pointing where its
 * link points, and the last one at the page itself.
 */
test('every breadcrumb a page shows is the breadcrumb it declares', () => {
  let checked = 0;

  for (const page of INDEXABLE) {
    const visible = visibleTrail(page.html);
    const lists = ofType(page, 'BreadcrumbList');

    if (visible === null) {
      expect(lists, `${page.path} declares a breadcrumb it does not show`).toEqual([]);
      continue;
    }

    expect(lists, page.path).toHaveLength(1);
    const items = lists[0]!.itemListElement as ListItem[];

    expect(
      items.map((item) => item.name),
      page.path,
    ).toEqual(visible.map((crumb) => crumb.name));
    expect(
      items.map((item) => item.position),
      page.path,
    ).toEqual(visible.map((_, index) => index + 1));
    expect(
      items.map((item) => item.item),
      page.path,
    ).toEqual(visible.map((crumb) => new URL(crumb.href ?? page.path, SITE_ORIGIN).href));

    checked += 1;
  }

  // 4 text pages, 15 categories and 194 signs, in two locales.
  expect(checked).toBeGreaterThan(400);
});

/**
 * Two types this site must never declare. `VideoObject` asks a search engine
 * for a thumbnail of the video — a frame of the gesture, which the sources do
 * not allow anyone to extract. `FAQPage` would describe prose as something it
 * is not, to take up more room in results.
 */
test('no page declares a video or an FAQ', () => {
  const offending = PAGES.flatMap((page) =>
    page.data
      .map((d) => JSON.stringify(d))
      .filter((json) => /"@type":"(VideoObject|FAQPage)"/.test(json))
      .map(() => page.path),
  );

  expect(offending).toEqual([]);
});

test('a page kept out of the index declares nothing', () => {
  const noindex = PAGES.filter((p) => p.noindex);
  expect(noindex.length).toBeGreaterThan(0);
  for (const page of noindex) expect(page.blocks, page.path).toEqual([]);
});

/**
 * The CSP is one header for all 428 pages, and the build hashes every inline
 * script into it. These blocks differ page by page and are never executed, so
 * hashing them would have grown the header by one hash per page and allowed
 * nothing. This is the check that the build step skipped them.
 */
test('the policy does not carry a hash for any block of structured data', () => {
  const headers = readFileSync(resolve(DIST, '_headers'), 'utf8');
  const policy = headers.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
  expect(policy).toBeDefined();

  const hashed = PAGES.flatMap((p) => p.blocks)
    .map(sourceHash)
    .filter((hash) => policy!.includes(hash));
  expect(hashed).toEqual([]);
});

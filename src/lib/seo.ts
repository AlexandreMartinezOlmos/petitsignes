/**
 * What search engines and social apps are told about this site.
 *
 * None of this is visible to a visitor, which is exactly why it needs tests: a
 * broken sitemap or a preview deployment that invites indexing fails silently
 * and is discovered weeks later in someone else's index. Keeping the logic here
 * as pure functions means the shape can be asserted without a browser, and the
 * endpoints in `src/pages/` stay thin enough to be obviously correct.
 */

import { DEFAULT_LOCALE, ROUTED_LOCALES, localeHref, type RoutedLocale } from './routing.ts';
import { SITE_ORIGIN } from './site.ts';

/**
 * Every locale-independent path the site publishes, in the order a reader would
 * meet them. Each one is emitted once per routed locale.
 *
 * This is the single list the sitemap and its test both read, so a page added
 * without a sitemap entry is a test failure rather than an omission nobody
 * notices. When a route per sign arrives, extend this from the content
 * collection rather than by hand.
 */
export const SITE_PATHS = ['/', '/el-projecte/', '/credits/', '/accessibilitat/'] as const;

/** The social card. 1200×630 is what every major platform crops from. */
export const OG_IMAGE = '/og.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Home-screen icons. Apple ignores the manifest, hence the separate 180. */
export const APPLE_TOUCH_ICON = '/apple-touch-icon.png';
export const WEB_MANIFEST = '/site.webmanifest';

/** XML text nodes: five characters and the document is well-formed. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absolute(path: string, origin: string): string {
  return new URL(path, origin).href;
}

/**
 * A sitemap where every URL also declares its translations.
 *
 * The `hreflang` alternates matter more here than the URL list does: the site
 * publishes the same catalogue twice, and without them the two locales compete
 * as duplicates instead of being understood as one page in two languages. The
 * `x-default` points at Catalan, which is what `/` serves.
 */
export function buildSitemap(
  origin: string = SITE_ORIGIN,
  paths: readonly string[] = SITE_PATHS,
  locales: readonly RoutedLocale[] = ROUTED_LOCALES,
): string {
  const urls = paths.flatMap((path) =>
    locales.map((locale) => {
      const alternates = [
        ...locales.map((other) => ({ hreflang: other, path: localeHref(path, other) })),
        { hreflang: 'x-default', path: localeHref(path, DEFAULT_LOCALE) },
      ];

      return [
        '  <url>',
        `    <loc>${escapeXml(absolute(localeHref(path, locale), origin))}</loc>`,
        ...alternates.map(
          (alt) =>
            `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" ` +
            `href="${escapeXml(absolute(alt.path, origin))}"/>`,
        ),
        '  </url>',
      ].join('\n');
    }),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * `robots.txt`, and the guard that keeps branch previews out of the index.
 *
 * Every branch is deployed to its own `*.pages.dev` origin with the same build.
 * Those deployments are for looking at, not for reading in search results — and
 * an indexed preview competes with production for the same content. Comparing
 * against `SITE_ORIGIN` rather than a build flag means the rule cannot be
 * forgotten: anything that is not the canonical domain refuses crawlers.
 */
export function buildRobots(origin: string = SITE_ORIGIN): string {
  if (origin !== SITE_ORIGIN) {
    return [
      '# Preview deployment — not the canonical site.',
      'User-agent: *',
      'Disallow: /',
      '',
    ].join('\n');
  }

  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${absolute('/sitemap.xml', origin)}`, ''].join(
    '\n',
  );
}

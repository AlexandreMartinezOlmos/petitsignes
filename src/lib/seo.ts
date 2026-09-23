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
 * notices.
 *
 * The 194 sign pages are deliberately NOT here: they come from the content
 * collection, which the endpoint appends (see `sitemap.xml.ts`). A list of words
 * written out twice is a list that disagrees with itself the first time the
 * vocabulary changes.
 */
export const SITE_PATHS = ['/', '/el-projecte/', '/credits/', '/accessibilitat/'] as const;

/**
 * The social card, one per locale: a link pasted into a Spanish conversation
 * previews in Spanish. Rendered by `npm run brand:assets` from each locale's own
 * strings. The Catalan card keeps the name it has always had, so previews that
 * apps have already cached for shared links stay valid.
 *
 * 1200×630 is what every major platform crops from.
 */
export const OG_IMAGES: Record<RoutedLocale, string> = { ca: '/og.png', es: '/og-es.png' };
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * Open Graph names a locale as language and territory, `ca_ES`, not the bare
 * `ca` of `<html lang>` — and a value outside that form is ignored, which
 * leaves the platform guessing the language of the card from its text.
 */
export const OG_LOCALES: Record<RoutedLocale, string> = { ca: 'ca_ES', es: 'es_ES' };

/** Home-screen icons. Apple ignores the manifest, hence the separate 180. */
export const APPLE_TOUCH_ICON = '/apple-touch-icon.png';
export const WEB_MANIFEST = '/site.webmanifest';

/**
 * Roughly where a search result stops showing a title. Google measures in
 * pixels, not characters, but 60 is the width a title of ordinary Latin text
 * reliably survives — past it, the end is replaced by an ellipsis.
 */
export const TITLE_MAX_LENGTH = 60;

const TITLE_SEPARATOR = ' · ';

/**
 * The `<title>` of a page: what it is about, and the site's name if there is
 * room for it.
 *
 * The page's own words come first because they are what someone searched for —
 * "llet en llengua de signes catalana", not "Petits Signes". The name is a
 * suffix that is only worth its sixteen characters when it fits: appended to a
 * title that is already long, all it does is push the end of the sentence past
 * the ellipsis, and the part cut off would be the name of the sign language.
 * Search results show the site's name on a line of their own anyway.
 *
 * Counted in code points rather than UTF-16 units, so «», accents and the
 * middle dot each count once, the way a reader counts them.
 */
export function documentTitle(title: string | undefined, siteName: string): string {
  if (title === undefined) return siteName;

  const withName = `${title}${TITLE_SEPARATOR}${siteName}`;
  return [...withName].length <= TITLE_MAX_LENGTH ? withName : title;
}

/** One schema.org object, ready to be serialised into a page. */
export type JsonLd = Readonly<Record<string, unknown>>;

/** One step of a breadcrumb trail, as a reader sees it and as a crawler follows it. */
export interface Crumb {
  name: string;
  /** Locale-resolved path, as the link on the page uses it (`/es/categoria/animals/`). */
  href: string;
}

/**
 * The site, as the home page of one locale describes it.
 *
 * This is what search results read the site's name from — the line above the
 * title — and the reason the home page's `<title>` can spend all of its width
 * on what the page is about. One per locale, each with its own address and
 * language, because each home is the entry to a different sign language.
 *
 * Deliberately the only kind of page-level entity the site declares. No
 * `VideoObject`: it would invite a search engine to show a frame of the
 * gesture, which the sources do not allow anyone to extract. No `FAQPage`:
 * there is no FAQ, and marking prose up as one to win space in results is the
 * kind of claim this site does not make.
 */
export function websiteJsonLd(
  name: string,
  homeHref: string,
  language: string,
  origin: string = SITE_ORIGIN,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: absolute(homeHref, origin),
    inLanguage: language,
  };
}

/**
 * The breadcrumb a page already shows, in the form search results display it
 * in place of the bare URL.
 *
 * Built from the same trail the visible breadcrumb is rendered from, so the
 * two cannot disagree: structured data that describes something the page does
 * not show is exactly what search engines penalise.
 */
export function breadcrumbJsonLd(trail: readonly Crumb[], origin: string = SITE_ORIGIN): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.href, origin),
    })),
  };
}

/**
 * The body of a `<script type="application/ld+json">`.
 *
 * `<` is escaped because the HTML parser, not JSON, decides where a script
 * ends: a label containing `</script>` would otherwise close the block and
 * spill the rest into the page. `<` is the same character to a JSON
 * parser, so the data is unchanged.
 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

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
 * A pointer, not a policy. The text-and-data-mining reservation itself is a
 * `tdm-reservation` header and `/.well-known/tdmrep.json` (see `public/`); this
 * line only means a person reading `robots.txt` — where everyone looks first —
 * finds out that it exists.
 *
 * It is a comment because it has to be. Cloudflare's managed `robots.txt` used
 * to state the same reservation as a `Content-Signal:` directive, and copying
 * that into the build cost three points of Lighthouse's SEO score on every one
 * of the twelve audited pages: the directive is not part of the robots.txt
 * grammar, so the validator reads it as a syntax error and marks the whole file
 * invalid. Machine-readable reservations belong in a format built for them.
 */
const TDM_POINTER = '# Text and data mining rights reserved: /.well-known/tdmrep.json';

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

  return [
    'User-agent: *',
    'Allow: /',
    '',
    TDM_POINTER,
    `Sitemap: ${absolute('/sitemap.xml', origin)}`,
    '',
  ].join('\n');
}

/**
 * The web app manifest, one per routed locale.
 *
 * It used to be a single static file in Catalan, so installing the site from
 * `/es/` put a Catalan description on the phone and opened the app on the
 * Catalan catalogue — the other sign language. Each locale now has its own,
 * built from the same translations the pages use, so the words cannot drift
 * from the site's.
 */

import { createTranslator } from './i18n.ts';
import { localeHref, type RoutedLocale } from './routing.ts';

/**
 * Hex, because a manifest cannot read an OKLCH custom property. These are
 * copies of `--brand` and `--surface`, and `color.test.ts` pins them to the
 * stylesheet so a brand change cannot leave the splash screen behind.
 */
export const MANIFEST_THEME_COLOR = '#bc461e';
export const MANIFEST_BACKGROUND_COLOR = '#fdf9f4';

/** Where a locale's manifest is served, linked from every page of that locale. */
export function manifestPath(locale: RoutedLocale): string {
  return localeHref('/site.webmanifest', locale);
}

export function webManifest(locale: RoutedLocale) {
  const t = createTranslator(locale);
  const home = localeHref('/', locale);

  return {
    // Explicit and distinct per locale, so installing from `/es/` is its own
    // app rather than an update of the Catalan one — the two open on
    // different sign languages.
    id: home,
    name: t('site.title'),
    short_name: t('site.title'),
    description: t('site.tagline'),
    lang: locale,
    start_url: home,
    // The whole site, not just this locale's half: the language selector is a
    // link, and following it inside the installed app should not throw the
    // visitor out into the browser.
    scope: '/',
    display: 'standalone',
    background_color: MANIFEST_BACKGROUND_COLOR,
    theme_color: MANIFEST_THEME_COLOR,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/**
 * The endpoint's response. In the static build only the body survives — it is
 * written to `site.webmanifest`, and the host types it by that extension
 * (Cloudflare answers `application/manifest+json`). The header is here for
 * `astro dev`, which serves the endpoint live.
 */
export function manifestResponse(locale: RoutedLocale): Response {
  return new Response(`${JSON.stringify(webManifest(locale), null, 2)}\n`, {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
}

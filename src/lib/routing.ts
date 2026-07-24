/**
 * Interface-language routing.
 *
 * Each routed locale lives at its own URL, decided at build time:
 *   - `ca` (the default) is served at the root, e.g. `/`, `/credits/`.
 *   - `es` is prefixed, e.g. `/es/`, `/es/credits/`.
 *
 * Putting the language in the URL — rather than in client state — is what keeps
 * the server-rendered and client-rendered markup identical, so there is no
 * hydration mismatch when a returning visitor has a different preference.
 *
 * The sign language follows from the locale (see `signLanguageOf`), so the URL
 * also determines which sign videos a page shows.
 */

import type { Language } from './types.ts';

/** Interface languages that are built and offered in the language selector. */
export const ROUTED_LOCALES = ['ca', 'es'] as const satisfies readonly Language[];
export type RoutedLocale = (typeof ROUTED_LOCALES)[number];

export const DEFAULT_LOCALE: RoutedLocale = 'ca';

/** Endonyms, shown in the language selector in the language itself. */
export const LOCALE_NAMES: Record<RoutedLocale, string> = {
  ca: 'Català',
  es: 'Castellano',
};

export function isRoutedLocale(value: string): value is RoutedLocale {
  return (ROUTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Maps a locale-independent path (always `/…/`) to the URL for a given locale.
 * The default locale keeps the bare path; others get a `/<locale>` prefix.
 *
 * @example localeHref('/', 'es')        // '/es/'
 * @example localeHref('/credits/', 'es') // '/es/credits/'
 */
export function localeHref(path: string, locale: RoutedLocale): string {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

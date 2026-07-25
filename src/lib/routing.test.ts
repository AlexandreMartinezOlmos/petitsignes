import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  ROUTED_LOCALES,
  isRoutedLocale,
  localeHref,
} from './routing.ts';
import { LANGUAGE_TO_SIGN_LANGUAGE } from './types.ts';

describe('localeHref', () => {
  it('leaves the default locale at the bare path', () => {
    expect(localeHref('/', 'ca')).toBe('/');
    expect(localeHref('/credits/', 'ca')).toBe('/credits/');
  });

  it('prefixes every other locale', () => {
    expect(localeHref('/', 'es')).toBe('/es/');
    expect(localeHref('/el-projecte/', 'es')).toBe('/es/el-projecte/');
  });

  it('keeps the trailing slash, which the static host needs to serve index.html', () => {
    for (const locale of ROUTED_LOCALES) {
      expect(localeHref('/accessibilitat/', locale)).toMatch(/\/$/);
    }
  });
});

describe('isRoutedLocale', () => {
  it('accepts the locales that are actually built', () => {
    for (const locale of ROUTED_LOCALES) {
      expect(isRoutedLocale(locale)).toBe(true);
    }
  });

  // `en` is translated but has no routes yet: treating it as routed would
  // produce links to pages the build never emits.
  it('rejects a translated language that has no route', () => {
    expect(isRoutedLocale('en')).toBe(false);
  });

  it('rejects a sign language: the two axes are separate', () => {
    expect(isRoutedLocale('lsc')).toBe(false);
    expect(isRoutedLocale('')).toBe(false);
  });
});

describe('routed locale metadata', () => {
  it('names every routed locale in its own language', () => {
    for (const locale of ROUTED_LOCALES) {
      expect(LOCALE_NAMES[locale]?.trim()).toBeTruthy();
    }
  });

  // Adding a locale without mapping it to a sign language would render cards
  // with no video block at all.
  it('maps every routed locale to a sign language', () => {
    for (const locale of ROUTED_LOCALES) {
      expect(LANGUAGE_TO_SIGN_LANGUAGE[locale]).toBeDefined();
    }
  });

  it('has the default locale among the routed ones', () => {
    expect(ROUTED_LOCALES).toContain(DEFAULT_LOCALE);
  });
});

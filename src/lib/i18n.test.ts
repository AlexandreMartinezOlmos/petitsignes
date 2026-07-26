import { describe, expect, it } from 'vitest';
import { MESSAGES, createTranslator, isLanguage } from './i18n.ts';
import type { StatusFilter } from './stores.ts';
import { LANGUAGES } from './types.ts';

describe('createTranslator', () => {
  it('translates into the requested language', () => {
    expect(createTranslator('ca')('nav.credits')).toBe('Fonts i crèdits');
    expect(createTranslator('es')('nav.credits')).toBe('Fuentes y créditos');
    expect(createTranslator('en')('nav.credits')).toBe('Sources and credits');
  });

  it('defaults to Catalan', () => {
    expect(createTranslator()('nav.credits')).toBe('Fonts i crèdits');
  });

  it('interpolates placeholders', () => {
    expect(createTranslator('es')('empty.search.title', { query: 'perro' })).toContain('perro');
    expect(createTranslator('es')('search.resultCount', { count: 3 })).toBe('3 signos');
  });

  it('leaves a placeholder untouched when no value is given', () => {
    expect(createTranslator('es')('search.resultCount')).toBe('{count} signos');
  });
});

describe('message catalogue', () => {
  it('defines the same keys in every language', () => {
    const reference = Object.keys(MESSAGES.ca).sort();

    for (const language of LANGUAGES) {
      expect(Object.keys(MESSAGES[language]).sort(), `missing keys in ${language}`).toEqual(
        reference,
      );
    }
  });

  /**
   * These labels are built as t(`filter.${key}`), so searching the source for
   * the literal key finds nothing and a cleanup sweep would read them as dead.
   * Pinning the contract here is what keeps that from happening — a generic
   * "unused key" detector cannot see a key that is never written out in full.
   */
  it('has a filter label for every status filter', () => {
    const statuses: StatusFilter[] = ['all', 'favorites', 'learned', 'pending'];

    for (const status of statuses) {
      expect(Object.keys(MESSAGES.ca), `filter.${status} is built dynamically`).toContain(
        `filter.${status}`,
      );
    }
  });

  /**
   * WCAG 2.2 §2.5.3 (Label in Name), enforced at the source of the two strings
   * rather than only on the rendered page.
   *
   * The categories button shows `filter.showCategories` and announces
   * `filter.showCategoriesLabel`. If the announced name does not contain what
   * is written on the button, speech control cannot activate it — which is
   * exactly what happened when the button read "+15 més" and announced "Mostra
   * les 15 categories". Translating one of the pair without the other is the
   * easy way to reintroduce it, and a translator has no reason to guess the
   * rule, so it is pinned here in every language.
   */
  it('announces the categories button starting with what it shows', () => {
    for (const language of LANGUAGES) {
      const visible = MESSAGES[language]['filter.showCategories'];
      const announced = MESSAGES[language]['filter.showCategoriesLabel'];

      expect(
        announced.startsWith(visible),
        `${language}: "${announced}" must start with the visible "${visible}"`,
      ).toBe(true);
    }
  });

  it('has no empty strings', () => {
    for (const language of LANGUAGES) {
      for (const [key, value] of Object.entries(MESSAGES[language])) {
        expect(value.trim(), `${language}.${key} is empty`).not.toBe('');
      }
    }
  });
});

describe('isLanguage', () => {
  it('accepts the supported interface languages', () => {
    expect(isLanguage('ca')).toBe(true);
    expect(isLanguage('es')).toBe(true);
    expect(isLanguage('en')).toBe(true);
  });

  it('rejects a sign language: the two axes are separate', () => {
    expect(isLanguage('lsc')).toBe(false);
    expect(isLanguage('lse')).toBe(false);
  });
});

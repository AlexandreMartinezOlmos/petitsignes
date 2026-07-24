import { describe, expect, it } from 'vitest';
import { MESSAGES, createTranslator, isLanguage } from './i18n.ts';
import { LANGUAGES } from './types.ts';

describe('createTranslator', () => {
  it('translates into the requested language', () => {
    expect(createTranslator('ca')('nav.credits')).toBe('Fonts i crèdits');
    expect(createTranslator('es')('nav.credits')).toBe('Fuentes y créditos');
    expect(createTranslator('en')('nav.credits')).toBe('Sources and credits');
  });

  it('defaults to Catalan', () => {
    expect(createTranslator()('nav.catalogue')).toBe('Catàleg');
  });

  it('interpolates placeholders', () => {
    expect(createTranslator('es')('search.noResults', { query: 'perro' })).toContain('perro');
    expect(createTranslator('es')('firstSigns.step', { order: 3 })).toBe('Paso 3');
  });

  it('leaves a placeholder untouched when no value is given', () => {
    expect(createTranslator('es')('firstSigns.step')).toBe('Paso {order}');
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

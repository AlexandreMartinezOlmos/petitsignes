import { describe, expect, it } from 'vitest';
import {
  MIN_QUERY_LENGTH,
  createSearchIndex,
  isSearchable,
  normalizeText,
  searchSigns,
  type SearchableSign,
} from './search.ts';

const SIGNS: SearchableSign[] = [
  { id: 'leche', labels: { ca: 'llet', es: 'leche', en: 'milk' }, category: 'food' },
  { id: 'agua', labels: { ca: 'aigua', es: 'agua', en: 'water' }, category: 'food' },
  { id: 'platano', labels: { ca: 'plàtan', es: 'plátano', en: 'banana' }, category: 'food' },
  { id: 'mama', labels: { ca: 'mama', es: 'mamá', en: 'mummy' }, category: 'family' },
  { id: 'perro', labels: { ca: 'gos', es: 'perro', en: 'dog' }, category: 'animals' },
];

const index = createSearchIndex(SIGNS);

describe('normalizeText', () => {
  it('lowercases', () => {
    expect(normalizeText('LECHE')).toBe('leche');
  });

  it('strips accents', () => {
    expect(normalizeText('plátano')).toBe('platano');
    expect(normalizeText('plàtan')).toBe('platan');
    expect(normalizeText('mamá')).toBe('mama');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeText('  agua  ')).toBe('agua');
  });

  // Deliberate: someone typing on a keyboard without ñ or ç should still find
  // the sign, so both are folded to their base letter.
  it('folds ñ and ç to their base letter', () => {
    expect(normalizeText('pañal')).toBe('panal');
    expect(normalizeText('abraçada')).toBe('abracada');
  });
});

describe('searchSigns', () => {
  it('finds an exact match', () => {
    expect(searchSigns(index, 'leche')).toContain('leche');
  });

  it('ignores case', () => {
    expect(searchSigns(index, 'LECHE')).toContain('leche');
  });

  it('ignores accents in the query', () => {
    expect(searchSigns(index, 'platano')).toContain('platano');
    expect(searchSigns(index, 'plátano')).toContain('platano');
  });

  it('matches partial words', () => {
    expect(searchSigns(index, 'plat')).toContain('platano');
  });

  it('searches Catalan and Spanish at the same time', () => {
    expect(searchSigns(index, 'gos')).toContain('perro');
    expect(searchSigns(index, 'perro')).toContain('perro');
  });

  it('also matches the English label', () => {
    expect(searchSigns(index, 'milk')).toContain('leche');
  });

  it('returns an empty array for an empty query', () => {
    expect(searchSigns(index, '')).toEqual([]);
    expect(searchSigns(index, '   ')).toEqual([]);
  });

  it('returns nothing for a word that is not in the catalogue', () => {
    expect(searchSigns(index, 'helicoptero')).toEqual([]);
  });

  it('respects the result limit', () => {
    // A dedicated index, so the assertion does not depend on how many entries
    // of the shared fixture happen to be near-matches.
    const many = createSearchIndex(
      Array.from({ length: 5 }, (_, i) => ({
        id: `sign-${i}`,
        labels: { ca: `gat${i}`, es: `gato${i}`, en: `cat${i}` },
        category: 'animals' as const,
      })),
    );

    expect(searchSigns(many, 'gat').length).toBeGreaterThan(2);
    expect(searchSigns(many, 'gat', 2)).toHaveLength(2);
  });

  // Regression: the index cannot answer a query shorter than MIN_QUERY_LENGTH,
  // and a caller that read the empty result as "no matches" emptied the grid on
  // the first keystroke of every search.
  it('returns nothing for a query shorter than the minimum', () => {
    expect(searchSigns(index, 'a')).toEqual([]);
    expect(isSearchable('a')).toBe(false);
  });
});

describe('isSearchable', () => {
  it('rejects a query with nothing to search for', () => {
    expect(isSearchable('')).toBe(false);
    expect(isSearchable('   ')).toBe(false);
  });

  it('accepts a query at the minimum length', () => {
    expect(isSearchable('ag')).toBe(true);
    expect(searchSigns(index, 'ag')).toContain('agua');
  });

  it('measures the normalised query, so an accent does not count twice', () => {
    // NFD splits "á" into a letter plus a combining mark; counting the raw
    // string would make a one-letter query look long enough.
    expect(isSearchable('á')).toBe(false);
    expect(MIN_QUERY_LENGTH).toBe(2);
  });
});

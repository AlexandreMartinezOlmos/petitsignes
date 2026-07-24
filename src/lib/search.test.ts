import { describe, expect, it } from 'vitest';
import { createSearchIndex, normalizeText, searchSigns, type SearchableSign } from './search.ts';

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
    expect(searchSigns(index, 'a', 2).length).toBeLessThanOrEqual(2);
  });
});

import { describe, expect, it } from 'vitest';
import { filterCards, type CardData, type FilterState } from './catalogue-grid.ts';
import { createSearchIndex } from './search.ts';

const CARDS: CardData[] = [
  {
    id: 'leche',
    labels: { ca: 'llet', es: 'leche', en: 'milk' },
    category: 'food',
    isFirstSign: true,
  },
  {
    id: 'agua',
    labels: { ca: 'aigua', es: 'agua', en: 'water' },
    category: 'food',
    isFirstSign: true,
  },
  {
    id: 'pan',
    labels: { ca: 'pa', es: 'pan', en: 'bread' },
    category: 'food',
    isFirstSign: false,
  },
  {
    id: 'perro',
    labels: { ca: 'gos', es: 'perro', en: 'dog' },
    category: 'animals',
    isFirstSign: false,
  },
];

const index = createSearchIndex(CARDS);

function state(overrides: Partial<FilterState> = {}): FilterState {
  return {
    query: '',
    category: null,
    onlyFirstSigns: false,
    statusFilter: 'all',
    favorites: [],
    learned: [],
    ...overrides,
  };
}

describe('filterCards', () => {
  it('shows everything with no filters', () => {
    expect(filterCards(CARDS, state(), index).size).toBe(4);
  });

  it('filters by category', () => {
    const visible = filterCards(CARDS, state({ category: 'animals' }), index);
    expect([...visible]).toEqual(['perro']);
  });

  it('filters the first-signs path', () => {
    const visible = filterCards(CARDS, state({ onlyFirstSigns: true }), index);
    expect([...visible].sort()).toEqual(['agua', 'leche']);
  });

  it('filters by favourites', () => {
    const visible = filterCards(
      CARDS,
      state({ statusFilter: 'favorites', favorites: ['pan'] }),
      index,
    );
    expect([...visible]).toEqual(['pan']);
  });

  it('treats "pending" as everything not yet learned', () => {
    const visible = filterCards(
      CARDS,
      state({ statusFilter: 'pending', learned: ['leche'] }),
      index,
    );
    expect(visible.has('leche')).toBe(false);
    expect(visible.size).toBe(3);
  });

  it('combines a status filter with a search', () => {
    const visible = filterCards(
      CARDS,
      state({ query: 'gos', statusFilter: 'favorites', favorites: ['perro'] }),
      index,
    );
    expect([...visible]).toEqual(['perro']);
  });

  it('excludes a search hit that fails the status filter', () => {
    const visible = filterCards(
      CARDS,
      state({ query: 'gos', statusFilter: 'favorites', favorites: ['leche'] }),
      index,
    );
    expect(visible.size).toBe(0);
  });

  // A parent searching for a word should find it regardless of which chip is
  // active, otherwise the search silently returns nothing.
  it('lets a search override the active category', () => {
    const visible = filterCards(CARDS, state({ query: 'gos', category: 'food' }), index);
    expect([...visible]).toEqual(['perro']);
  });

  it('lets a search override the first-signs chip', () => {
    const visible = filterCards(CARDS, state({ query: 'pan', onlyFirstSigns: true }), index);
    expect([...visible]).toEqual(['pan']);
  });

  it('returns nothing when the query matches no sign', () => {
    expect(filterCards(CARDS, state({ query: 'helicoptero' }), index).size).toBe(0);
  });

  it('falls back to plain filtering when there is no index', () => {
    const visible = filterCards(CARDS, state({ category: 'food' }), null);
    expect(visible.size).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import {
  FIRST_SIGNS_SECTION,
  filterCards,
  readCardData,
  sectionOf,
  type CardData,
  type FilterState,
} from './catalogue-grid.ts';
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

  // Regression: a one-character query is shorter than the index can answer, so
  // reading its empty result as "no matches" hid the whole catalogue on the
  // first keystroke of every search.
  it('treats a query too short to search as no search at all', () => {
    expect(filterCards(CARDS, state({ query: 'a' }), index).size).toBe(CARDS.length);
  });

  it('still honours the other filters while the query is too short', () => {
    const visible = filterCards(CARDS, state({ query: 'a', category: 'food' }), index);
    expect(visible.size).toBe(3);
  });

  it('falls back to plain filtering when there is no index', () => {
    const visible = filterCards(CARDS, state({ category: 'food' }), null);
    expect(visible.size).toBe(3);
  });
});

/**
 * The grid prints a heading before each run of signs, and the controller uses
 * this to decide which of those headings still has anything under it. The rule
 * has to match the order CatalogueView sorts by, or a heading would end up
 * over the wrong group — or over nothing at all.
 */
describe('sectionOf', () => {
  it('puts a curated first sign under the guided route, not its category', () => {
    const leche = CARDS.find((card) => card.id === 'leche')!;

    expect(leche.category).toBe('food');
    expect(sectionOf(leche)).toBe(FIRST_SIGNS_SECTION);
  });

  it('puts every other sign under its own category', () => {
    expect(sectionOf(CARDS.find((card) => card.id === 'pan')!)).toBe('food');
    expect(sectionOf(CARDS.find((card) => card.id === 'perro')!)).toBe('animals');
  });

  it('assigns every card to exactly one section', () => {
    // A card in two runs would be printed twice; a card in none would sit
    // under whichever heading happened to come before it.
    for (const card of CARDS) {
      expect(sectionOf(card)).toBeTruthy();
    }
    expect(new Set(CARDS.map(sectionOf))).toEqual(
      new Set([FIRST_SIGNS_SECTION, 'food', 'animals']),
    );
  });
});

/**
 * The boundary between the static grid and everything that reads it. The
 * catalogue is never shipped as JSON — it is recovered from the cards' data
 * attributes — so a card whose markup is incomplete has to be dropped rather
 * than turned into an entry with holes in it.
 */
describe('readCardData', () => {
  function card(attributes: Record<string, string>): HTMLElement {
    const element = document.createElement('article');
    for (const [name, value] of Object.entries(attributes)) {
      element.dataset[name] = value;
    }
    return element;
  }

  const complete = {
    signId: 'leche',
    category: 'food',
    firstSign: 'true',
    labelCa: 'llet',
    labelEs: 'leche',
    labelEn: 'milk',
  };

  it('reads a card back out of its attributes', () => {
    expect(readCardData(card(complete))).toEqual({
      id: 'leche',
      category: 'food',
      isFirstSign: true,
      labels: { ca: 'llet', es: 'leche', en: 'milk' },
    });
  });

  it('treats anything but "true" as not being a first sign', () => {
    expect(readCardData(card({ ...complete, firstSign: 'false' }))?.isFirstSign).toBe(false);

    // The attribute is always written, but a missing one must not be read as
    // membership of the curated route.
    const { firstSign: _omitted, ...withoutFlag } = complete;
    expect(readCardData(card(withoutFlag))?.isFirstSign).toBe(false);
  });

  it('drops a card that is missing any field it needs', () => {
    for (const field of ['signId', 'category', 'labelCa', 'labelEs', 'labelEn'] as const) {
      const { [field]: _removed, ...rest } = complete;
      expect(readCardData(card(rest)), `missing ${field}`).toBeNull();
    }
  });
});

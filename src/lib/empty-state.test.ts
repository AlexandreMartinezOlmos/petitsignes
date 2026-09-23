import { describe, expect, it } from 'vitest';
import { EMPTY_STATE_MESSAGES, emptyStateFor } from './empty-state.ts';
import { STATUS_FILTERS } from './stores.ts';

describe('emptyStateFor', () => {
  it('blames a search only when a search actually ran', () => {
    expect(emptyStateFor('zzzz', 'all').title).toBe('empty.search.title');
    // One character is below what the index can search: no search ran, so
    // saying "no signs for «z»" would describe something that did not happen.
    expect(emptyStateFor('z', 'all').title).toBe('empty.generic.title');
    expect(emptyStateFor('   ', 'all').title).toBe('empty.generic.title');
  });

  it('puts the search ahead of the status filter it was combined with', () => {
    expect(emptyStateFor('zzzz', 'favorites').title).toBe('empty.search.title');
  });

  it('gives each status filter its own reason', () => {
    expect(emptyStateFor('', 'favorites').title).toBe('empty.favorites.title');
    expect(emptyStateFor('', 'learned').title).toBe('empty.learned.title');
    expect(emptyStateFor('', 'pending').title).toBe('empty.pending.title');
    expect(emptyStateFor('', 'all').title).toBe('empty.generic.title');
  });

  it('only ever asks for strings the page was told to carry', () => {
    const carried = new Set<string>(EMPTY_STATE_MESSAGES);
    for (const status of STATUS_FILTERS) {
      for (const query of ['', 'zzzz']) {
        const { title, hint } = emptyStateFor(query, status);
        expect(carried.has(title) && carried.has(hint), `${status}, «${query}»`).toBe(true);
      }
    }
  });
});

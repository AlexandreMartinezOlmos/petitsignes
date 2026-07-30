import { beforeEach, describe, expect, it } from 'vitest';
import {
  $category,
  $favorites,
  $learned,
  $onlyFirstSigns,
  $query,
  $statusFilter,
  clearFilters,
  getProgressStore,
  hydrateFromStorage,
  rememberLanguage,
  setProgressStore,
  toggleFavorite,
  toggleLearned,
} from './stores.ts';
import { LocalStorageProgressStore, type ProgressStore } from './storage.ts';

/**
 * These functions are the seam between persistence and what is on screen, and
 * they were the one part of `src/lib` with no unit tests at all — 0% of its
 * functions — because they sit next to the browser-only grid controller and got
 * treated as if they were browser-only too. They are not: everything here works
 * against the `ProgressStore` interface, which is exactly what `setProgressStore`
 * exists to let a test replace.
 *
 * The failure they guard against is quiet. Writing to the store but not the atom
 * leaves the card looking un-favourited until a reload; writing to the atom but
 * not the store loses it on the next visit. Both look fine in a screenshot.
 */

/** In-memory `Storage`, so nothing here depends on a real localStorage. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

function freshStore(): ProgressStore {
  const store = new LocalStorageProgressStore(fakeStorage());
  setProgressStore(store);
  return store;
}

beforeEach(() => {
  // `setProgressStore` also clears the memoised hydration, so each test starts
  // with both the store and the "has it loaded yet" state reset.
  setProgressStore(null);
  clearFilters();
  $favorites.set([]);
  $learned.set([]);
});

describe('the progress store singleton', () => {
  it('is created on demand and reused', () => {
    setProgressStore(null);
    expect(getProgressStore()).toBe(getProgressStore());
  });
});

describe('hydrating from storage', () => {
  it('brings saved favourites and learned signs into the stores', async () => {
    const store = freshStore();
    await store.toggleFavorite('leche');
    await store.toggleLearned('agua');
    $favorites.set([]);
    $learned.set([]);

    await hydrateFromStorage();

    expect($favorites.get()).toEqual(['leche']);
    expect($learned.get()).toEqual(['agua']);
  });

  /**
   * Every caller awaits the same read.
   *
   * This was a boolean flag, so the second caller got an already-resolved promise
   * while the first was still reading — harmless while nobody awaited it, wrong
   * the moment the catalogue started waiting for this before revealing a grid
   * filtered by favourites. With a flag the second `await` below resolves against
   * empty stores and the assertion fails.
   */
  it('makes a second caller wait for the first read rather than resolving early', async () => {
    const store = freshStore();
    await store.toggleFavorite('leche');
    $favorites.set([]);

    const first = hydrateFromStorage();
    const second = hydrateFromStorage();
    expect(second).toBe(first);

    await second;
    expect($favorites.get()).toEqual(['leche']);
  });

  it('does not read twice', async () => {
    const store = freshStore();
    await hydrateFromStorage();

    // A change made behind the stores' back is not picked up by a second call:
    // hydration is a one-off, and the toggles below are what keep things in step.
    await store.toggleFavorite('leche');
    await hydrateFromStorage();

    expect($favorites.get()).toEqual([]);
  });
});

describe('toggling from the grid', () => {
  it('writes a favourite to storage and to the store in one step', async () => {
    const store = freshStore();

    await toggleFavorite('leche');

    expect($favorites.get()).toEqual(['leche']);
    expect(await store.getFavorites()).toEqual(['leche']);
  });

  it('takes a favourite away again', async () => {
    const store = freshStore();
    await toggleFavorite('leche');
    await toggleFavorite('leche');

    expect($favorites.get()).toEqual([]);
    expect(await store.getFavorites()).toEqual([]);
  });

  it('keeps learned signs on their own list', async () => {
    const store = freshStore();

    await toggleLearned('agua');

    expect($learned.get()).toEqual(['agua']);
    expect($favorites.get()).toEqual([]);
    expect(await store.getLearned()).toEqual(['agua']);
  });
});

describe('remembering the language', () => {
  /**
   * §4.2: the interface language decides the sign language. Storing the language
   * without deriving the sign language would leave an exported file claiming a
   * pairing the site never serves.
   */
  it('stores the sign language the locale implies, not just the locale', async () => {
    const store = freshStore();

    await rememberLanguage('es');
    expect(await store.getPreferences()).toEqual({ language: 'es', signLanguage: 'lse' });

    await rememberLanguage('ca');
    expect(await store.getPreferences()).toEqual({ language: 'ca', signLanguage: 'lsc' });
  });
});

describe('clearing the filters', () => {
  it('resets every one of them, not just the search', () => {
    $query.set('llet');
    $category.set('food');
    $onlyFirstSigns.set(true);
    $statusFilter.set('learned');

    clearFilters();

    expect($query.get()).toBe('');
    expect($category.get()).toBeNull();
    expect($onlyFirstSigns.get()).toBe(false);
    expect($statusFilter.get()).toBe('all');
  });
});

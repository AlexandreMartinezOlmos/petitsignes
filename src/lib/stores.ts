/**
 * Shared client state.
 *
 * The catalogue grid is rendered as static HTML at build time; these stores
 * drive which cards are visible and which badges are lit. Keeping the state
 * here lets the React toolbar and the plain-DOM grid controller stay in sync
 * without shipping the whole catalogue to the browser as JavaScript.
 *
 * Note what is deliberately NOT here: the interface language and the sign
 * language. Both are decided by the URL at build time (see `lib/routing.ts`),
 * so nothing about the visible language depends on hydrating client state.
 */

import { atom, computed } from 'nanostores';
import { LocalStorageProgressStore, type ProgressStore } from './storage.ts';
import { signLanguageOf, type CategoryId, type Language } from './types.ts';

export type StatusFilter = 'all' | 'favorites' | 'learned' | 'pending';

/**
 * The closed set of status filters, in the order the toolbar offers them.
 *
 * Declared next to the type rather than in the toolbar because it is no longer
 * only a list of buttons: `catalogue-history.ts` validates a restored value
 * against it, and a second copy of the set is a second thing to forget.
 *
 * Each value doubles as its own message key (`filter.favorites`), so no parallel
 * label field exists to drift from it; `i18n.test.ts` pins that every value here
 * has a message in all three languages.
 */
export const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'favorites', 'learned', 'pending'];

export const $query = atom<string>('');
export const $category = atom<CategoryId | null>(null);
export const $onlyFirstSigns = atom<boolean>(false);

export const $statusFilter = atom<StatusFilter>('all');

export const $favorites = atom<readonly string[]>([]);
export const $learned = atom<readonly string[]>([]);

/** Number of cards currently passing every filter, for the live result count. */
export const $visibleCount = atom<number>(-1);

export const $hasActiveFilters = computed(
  [$query, $category, $onlyFirstSigns, $statusFilter],
  (query, category, onlyFirstSigns, statusFilter) =>
    query.trim() !== '' || category !== null || onlyFirstSigns || statusFilter !== 'all',
);

let progressStore: ProgressStore | null = null;

/**
 * The store is created lazily so that importing this module during SSR never
 * touches `localStorage`.
 */
export function getProgressStore(): ProgressStore {
  progressStore ??= new LocalStorageProgressStore();
  return progressStore;
}

/** Test seam: lets a test inject its own implementation. */
export function setProgressStore(store: ProgressStore | null): void {
  stopMirroring?.();
  stopMirroring = null;
  progressStore = store;
  hydration = null;
}

let hydration: Promise<void> | null = null;
let stopMirroring: (() => void) | null = null;

/**
 * Loads persisted favourites and learned signs into the stores, and keeps them
 * in step from then on.
 *
 * It subscribes rather than reading once, because the store also reports changes
 * made in another tab: a star pressed there lights up here without a reload, and
 * nobody presses a button on a card whose state is out of date.
 *
 * The promise is memoised rather than guarded by a boolean, so that every caller
 * awaits the same work. With a flag, the second caller returned an
 * already-resolved promise while the first was still reading storage — fine when
 * nobody awaited it, wrong now that the catalogue waits for this before showing a
 * grid filtered by favourites.
 */
export function hydrateFromStorage(): Promise<void> {
  hydration ??= new Promise((resolve) => {
    stopMirroring = getProgressStore().subscribe((snapshot) => {
      $favorites.set(snapshot.favorites);
      $learned.set(snapshot.learned);
      resolve();
    });
  });

  return hydration;
}

/**
 * Records the language of the page the visitor is on. Nothing on screen depends
 * on this — the URL is the source of truth — but persisting it keeps the
 * exported progress complete and leaves room for a future "continue in your
 * language" hint.
 */
export async function rememberLanguage(language: Language): Promise<void> {
  await getProgressStore().setPreferences({
    language,
    signLanguage: signLanguageOf(language),
  });
}

// Neither toggle writes to the atoms: the subscription set up by
// `hydrateFromStorage` does, for this tab's changes and every other tab's alike.
// Awaiting it first guarantees that subscription exists.

export async function toggleFavorite(id: string): Promise<void> {
  await hydrateFromStorage();
  await getProgressStore().toggleFavorite(id);
}

export async function toggleLearned(id: string): Promise<void> {
  await hydrateFromStorage();
  await getProgressStore().toggleLearned(id);
}

export function clearFilters(): void {
  $query.set('');
  $category.set(null);
  $onlyFirstSigns.set(false);
  $statusFilter.set('all');
}

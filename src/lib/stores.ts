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
  progressStore = store;
}

let hydrated = false;

/** Loads persisted favourites and learned signs into the stores. */
export async function hydrateFromStorage(): Promise<void> {
  if (hydrated) return;
  hydrated = true;

  const store = getProgressStore();
  const [favorites, learned] = await Promise.all([store.getFavorites(), store.getLearned()]);

  $favorites.set(favorites);
  $learned.set(learned);
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

export async function toggleFavorite(id: string): Promise<void> {
  const store = getProgressStore();
  await store.toggleFavorite(id);
  $favorites.set(await store.getFavorites());
}

export async function toggleLearned(id: string): Promise<void> {
  const store = getProgressStore();
  await store.toggleLearned(id);
  $learned.set(await store.getLearned());
}

export function clearFilters(): void {
  $query.set('');
  $category.set(null);
  $onlyFirstSigns.set(false);
  $statusFilter.set('all');
}

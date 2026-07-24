/**
 * Catalogue grid controller.
 *
 * The grid itself is static HTML built at compile time. This module only reads
 * the cards' data attributes and toggles visibility and badge state, which
 * keeps the shipped JavaScript independent of how many signs exist.
 */

import type Fuse from 'fuse.js';
import { createSearchIndex, isSearchable, searchSigns, type SearchableSign } from './search.ts';
import {
  $category,
  $favorites,
  $learned,
  $onlyFirstSigns,
  $query,
  $statusFilter,
  $visibleCount,
  hydrateFromStorage,
  toggleFavorite,
  toggleLearned,
  type StatusFilter,
} from './stores.ts';
import type { CategoryId, Language } from './types.ts';

export interface CardData extends SearchableSign {
  isFirstSign: boolean;
}

export interface FilterState {
  query: string;
  category: CategoryId | null;
  onlyFirstSigns: boolean;
  statusFilter: StatusFilter;
  favorites: readonly string[];
  learned: readonly string[];
}

/** Detail of the event that asks the player to open. */
export interface PlayRequestDetail {
  signId: string;
  label: string;
  signLanguage: string;
  videoUrl: string;
  posterUrl: string;
  source: string;
  sourceUrl: string;
  license: string;
}

export const PLAY_EVENT = 'sign:play';

export function readCardData(element: HTMLElement): CardData | null {
  const { signId, category, firstSign, labelCa, labelEs, labelEn } = element.dataset;
  if (!signId || !category || !labelCa || !labelEs || !labelEn) return null;

  return {
    id: signId,
    category: category as CategoryId,
    isFirstSign: firstSign === 'true',
    labels: { ca: labelCa, es: labelEs, en: labelEn },
  };
}

function matchesStatus(id: string, state: FilterState): boolean {
  switch (state.statusFilter) {
    case 'favorites':
      return state.favorites.includes(id);
    case 'learned':
      return state.learned.includes(id);
    case 'pending':
      return !state.learned.includes(id);
    case 'all':
      return true;
  }
}

/**
 * Pure filtering step: given every card and the current filters, returns the
 * ids that should stay visible. Kept free of DOM access so it can be tested.
 */
export function filterCards(
  cards: readonly CardData[],
  state: FilterState,
  index: Fuse<SearchableSign & { normalized: Record<Language, string> }> | null,
): Set<string> {
  const trimmedQuery = state.query.trim();

  // A search is a global lookup: it ignores the category chips so that finding
  // a word never depends on which chip happens to be selected.
  //
  // `isSearchable`, not `!== ''`: the index cannot answer a one-character
  // query, so treating it as an active search would empty the grid on the first
  // keystroke of every search. Below that length the visitor has not expressed
  // an intent yet, and the honest state is the full catalogue.
  const searchMatches =
    isSearchable(trimmedQuery) && index !== null
      ? new Set(searchSigns(index, trimmedQuery, cards.length))
      : null;

  const visible = new Set<string>();

  for (const card of cards) {
    if (searchMatches !== null && !searchMatches.has(card.id)) continue;
    if (searchMatches === null) {
      if (state.onlyFirstSigns && !card.isFirstSign) continue;
      if (state.category !== null && card.category !== state.category) continue;
    }
    if (!matchesStatus(card.id, state)) continue;
    visible.add(card.id);
  }

  return visible;
}

function setToggleState(button: HTMLButtonElement, pressed: boolean): void {
  button.setAttribute('aria-pressed', String(pressed));
  const label = pressed ? button.dataset.labelOn : button.dataset.labelOff;
  if (label) button.setAttribute('aria-label', label);
}

/** Wires the static grid to the shared stores. Returns a cleanup function. */
export function mountCatalogue(root: HTMLElement): () => void {
  const cardElements = Array.from(root.querySelectorAll<HTMLElement>('.sign-card'));
  const cards = cardElements.map(readCardData).filter((card): card is CardData => card !== null);

  const byId = new Map<string, HTMLElement>();
  for (const element of cardElements) {
    const id = element.dataset.signId;
    if (id) byId.set(id, element);
  }

  // Built once from the DOM, so the catalogue is never duplicated in the bundle.
  const index = createSearchIndex(cards);

  function applyFilters(): void {
    const visible = filterCards(cards, readFilterState(), index);

    for (const [id, element] of byId) {
      element.hidden = !visible.has(id);
    }

    $visibleCount.set(visible.size);
  }

  function applyProgress(): void {
    const favorites = $favorites.get();
    const learned = $learned.get();

    for (const [id, element] of byId) {
      const isLearned = learned.includes(id);
      element.dataset.learned = String(isLearned);

      const favoriteButton = element.querySelector<HTMLButtonElement>('[data-action="favorite"]');
      if (favoriteButton) setToggleState(favoriteButton, favorites.includes(id));

      const learnedButton = element.querySelector<HTMLButtonElement>('[data-action="learned"]');
      if (learnedButton) setToggleState(learnedButton, isLearned);
    }
  }

  function readFilterState(): FilterState {
    return {
      query: $query.get(),
      category: $category.get(),
      onlyFirstSigns: $onlyFirstSigns.get(),
      statusFilter: $statusFilter.get(),
      favorites: $favorites.get(),
      learned: $learned.get(),
    };
  }

  function onClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;

    const signId = button.dataset.signId;
    if (!signId) return;

    switch (button.dataset.action) {
      case 'favorite':
        void toggleFavorite(signId);
        break;
      case 'learned':
        void toggleLearned(signId);
        break;
      case 'play':
        root.dispatchEvent(
          new CustomEvent<PlayRequestDetail>(PLAY_EVENT, {
            bubbles: true,
            detail: {
              signId,
              label: button.dataset.label ?? signId,
              signLanguage: button.dataset.signLanguage ?? '',
              videoUrl: button.dataset.videoUrl ?? '',
              posterUrl: button.dataset.posterUrl ?? '',
              source: button.dataset.source ?? '',
              sourceUrl: button.dataset.sourceUrl ?? '',
              license: button.dataset.license ?? '',
            },
          }),
        );
        break;
    }
  }

  root.addEventListener('click', onClick);

  const unsubscribers = [
    $query.subscribe(applyFilters),
    $category.subscribe(applyFilters),
    $onlyFirstSigns.subscribe(applyFilters),
    $statusFilter.subscribe(applyFilters),
    $favorites.subscribe(() => {
      applyProgress();
      applyFilters();
    }),
    $learned.subscribe(() => {
      applyProgress();
      applyFilters();
    }),
  ];

  void hydrateFromStorage();

  return () => {
    root.removeEventListener('click', onClick);
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

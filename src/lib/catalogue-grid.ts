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
  type StatusFilter,
} from './stores.ts';
import { mountSignCards } from './sign-cards.ts';
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

/**
 * Which run of the grid a card sits under. The curated route comes first and
 * is its own section, so a first sign is listed there and not again under its
 * category. Kept in step with the section headings emitted by CatalogueView.
 */
export const FIRST_SIGNS_SECTION = 'first-signs';

export function sectionOf(card: CardData): string {
  return card.isFirstSign ? FIRST_SIGNS_SECTION : card.category;
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

  // Headings printed between the runs of signs. Which run a card belongs to is
  // derived rather than stored on the element: the grouping is already implied
  // by `isFirstSign` and the category, and a third attribute on 194 cards
  // could only ever disagree with them.
  const sectionElements = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>('[data-section]')) {
    const id = element.dataset.section;
    if (id) sectionElements.set(id, element);
  }

  function applyFilters(): void {
    const visible = filterCards(cards, readFilterState(), index);

    for (const [id, element] of byId) {
      element.hidden = !visible.has(id);
    }

    // A heading with nothing under it reads as an empty category rather than
    // as a filtered one, so the populated sections are collected first and the
    // rest are hidden.
    if (sectionElements.size > 0) {
      const populated = new Set<string>();
      for (const card of cards) {
        if (visible.has(card.id)) populated.add(sectionOf(card));
      }
      for (const [id, element] of sectionElements) {
        element.hidden = !populated.has(id);
      }
    }

    $visibleCount.set(visible.size);
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

  const unsubscribers = [
    $query.subscribe(applyFilters),
    $category.subscribe(applyFilters),
    $onlyFirstSigns.subscribe(applyFilters),
    $statusFilter.subscribe(applyFilters),
    $favorites.subscribe(applyFilters),
    $learned.subscribe(applyFilters),
  ];

  // Last, so the filters are already listening when hydration lands: the toggles
  // change which cards a status filter shows, not only how they look.
  const unmountCards = mountSignCards(root);

  return () => {
    unmountCards();
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

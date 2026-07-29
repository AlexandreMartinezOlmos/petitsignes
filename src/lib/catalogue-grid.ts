/**
 * Catalogue grid controller.
 *
 * The grid itself is static HTML built at compile time. This module only reads
 * the cards' data attributes and toggles visibility and badge state, which
 * keeps the shipped JavaScript independent of how many signs exist.
 */

import type Fuse from 'fuse.js';
import { ANALYTICS_EVENTS, countEvent } from './analytics.ts';
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

/**
 * Turns a card's play button into the request the video dialog listens for.
 *
 * Exported because the catalogue is not the only page that shows a card: the
 * 404 offers one too, and it needs the button to work without paying for the
 * whole grid controller. Everything the dialog needs travels on the button's
 * own dataset, so nothing here has to know where the card came from.
 */
export function dispatchPlayRequest(button: HTMLElement, signId: string): void {
  countEvent(ANALYTICS_EVENTS.playLsc);
  button.dispatchEvent(
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

function setToggleState(button: HTMLButtonElement, pressed: boolean): void {
  button.setAttribute('aria-pressed', String(pressed));
  const label = pressed ? button.dataset.labelOn : button.dataset.labelOff;
  if (label) button.setAttribute('aria-label', label);
}

/**
 * Wires the parts of a card that work wherever one is rendered: the two
 * progress toggles and the route to the video.
 *
 * Split out from the catalogue because the grid is not the only page that shows
 * a card — the 404 offers one too, and a toggle that silently did nothing there
 * would be the same broken promise C3 removed from the missing-video note. What
 * a single card needs is progress and playback; the filtering, the search index
 * and the section headings all belong to the grid and stay there.
 */
export function mountSignCards(root: HTMLElement): () => void {
  const byId = new Map<string, HTMLElement>();
  // `data-progress-for` rather than `.sign-card`: a class is a look, and the
  // sign's own page shows the same two toggles without being a card. The
  // attribute states the contract instead — this element carries the progress
  // state of that id — so a third presentation needs no change here.
  for (const element of root.querySelectorAll<HTMLElement>('[data-progress-for]')) {
    const id = element.dataset.progressFor;
    if (id) byId.set(id, element);
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

  function onClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Leaving for the source dictionary is the LSE equivalent of playing a
    // video, and the only way to tell whether that delivery gets used at all.
    if (target.closest('a.sign-card__cta--external')) {
      countEvent(ANALYTICS_EVENTS.openLse);
      return;
    }

    const button = target.closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;

    const signId = button.dataset.signId;
    if (!signId) return;

    switch (button.dataset.action) {
      case 'favorite':
        // Only the additions: a count of removals says little, and the pair
        // would start to look like a per-visitor history.
        if (button.getAttribute('aria-pressed') !== 'true') {
          countEvent(ANALYTICS_EVENTS.addFavorite);
        }
        void toggleFavorite(signId);
        break;
      case 'learned':
        if (button.getAttribute('aria-pressed') !== 'true') {
          countEvent(ANALYTICS_EVENTS.markLearned);
        }
        void toggleLearned(signId);
        break;
      case 'play':
        dispatchPlayRequest(button, signId);
        break;
    }
  }

  root.addEventListener('click', onClick);

  const unsubscribers = [$favorites.subscribe(applyProgress), $learned.subscribe(applyProgress)];

  void hydrateFromStorage();

  return () => {
    root.removeEventListener('click', onClick);
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
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
  // by `isFirstSign` and the category, and a third attribute on 195 cards
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

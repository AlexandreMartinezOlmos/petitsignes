/**
 * Remembering what the catalogue was showing.
 *
 * Until the sign pages arrived nobody ever left the catalogue, so the filters
 * living purely in memory cost nothing. Now the word on a card is a link, and
 * measured on production: search "llet" → 11 cards → open the sign → back →
 * empty search, 194 cards, scrolled to the top. The bug was always there; the
 * detail page only made it reachable.
 *
 * The state travels in `history.state`, which the browser keeps beside the
 * history entry and **never sends anywhere**. That is not a detail, it is the
 * whole reason this module exists instead of a query string.
 *
 * ## Why not the URL
 *
 * `?q=llet` looks like the obvious answer — shareable, bookmarkable, back and
 * forward for free. It cannot be used here. GoatCounter's `count.js` builds its
 * payload with `q: location.search`, read straight from the location and sent on
 * every hit; the settings it honours are `no_onload`, `no_events`,
 * `allow_local`, `allow_frame`, `path`, `title`, `referrer` and `event`, and `q`
 * is not among them. Its `get_path()` then appends `location.search` a second
 * time. So a query string publishes whatever a parent typed into the search box,
 * which is exactly what §2.2 promises never happens — and no configuration
 * prevents it. Patching around it would mean overriding a third-party script's
 * internals and betting a privacy promise on them not changing.
 *
 * The fragment (`#q=llet`) would be immune, since it never leaves the browser.
 * It was rejected for a different reason: this page already spends its fragment
 * on `#main` and `#footer-nav`, the skip and bypass links. Storing state there
 * would mean those two accessibility features wipe the filters, and the repair
 * would be machinery sitting directly in the keyboard path.
 *
 * So the URL is left alone entirely, and there is an e2e test asserting it stays
 * that way. Sharing a filtered view is answered by the category pages, which are
 * real addresses with real content behind them.
 *
 * ## Why only `replaceState`
 *
 * Every change overwrites the current entry rather than pushing a new one. With
 * no URL to change, `pushState` would leave the back button visibly doing
 * nothing while the grid rearranged underneath it, and a visitor who touched
 * five chips would need six presses to leave the site. Overwriting keeps back
 * meaning "the page before this one", which is what it means everywhere else.
 */

import { CATEGORY_IDS, type CategoryId } from './types.ts';
import {
  $category,
  $onlyFirstSigns,
  $query,
  $statusFilter,
  STATUS_FILTERS,
  type StatusFilter,
} from './stores.ts';

/** What the catalogue needs in order to look the way it looked. */
export interface CatalogueState {
  query: string;
  category: CategoryId | null;
  onlyFirstSigns: boolean;
  statusFilter: StatusFilter;
}

export const DEFAULT_CATALOGUE_STATE: CatalogueState = {
  query: '',
  category: null,
  onlyFirstSigns: false,
  statusFilter: 'all',
};

/**
 * Marks the entry as ours. `history.state` is shared with anything else that
 * writes history for this origin — a browser extension, a future feature, an
 * older deploy of this same site — so a shape that merely looks plausible is not
 * good enough to act on.
 */
export const CATALOGUE_STATE_KEY = 'petitsignes:catalogue';

/**
 * Set on `<html>` while a restored grid has not been filtered yet, so CSS can
 * keep it from being shown unfiltered. See the inline script in
 * `CatalogueView.astro` for why that matters and `revealCatalogue` for who
 * clears it.
 */
export const CATALOGUE_RESTORING_ATTR = 'data-catalogue-restoring';

/** Lets the grid be seen, once it is showing the right cards. */
export function revealCatalogue(): void {
  document.documentElement.removeAttribute(CATALOGUE_RESTORING_ATTR);
}

/** Longest query kept. Long enough for any label; short enough to stay small. */
const MAX_QUERY_LENGTH = 100;

/**
 * Reads a `history.state` value into filter state, or returns null.
 *
 * Validated the same way an imported progress file is: every field is checked
 * against the closed set it belongs to, and anything unrecognised is dropped
 * rather than trusted. A `category` that is no longer in `CATEGORY_IDS` is the
 * realistic case — a retired concept's category, or a link from an older
 * deploy — and silently ignoring it is better than filtering the grid down to
 * nothing with no way for the visitor to see why.
 */
export function readCatalogueState(raw: unknown): CatalogueState | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const envelope = (raw as Record<string, unknown>)[CATALOGUE_STATE_KEY];
  if (typeof envelope !== 'object' || envelope === null) return null;

  const stored = envelope as Record<string, unknown>;

  const query =
    typeof stored.query === 'string'
      ? stored.query.slice(0, MAX_QUERY_LENGTH)
      : DEFAULT_CATALOGUE_STATE.query;

  const category = CATEGORY_IDS.find((id) => id === stored.category) ?? null;

  const statusFilter =
    STATUS_FILTERS.find((value) => value === stored.statusFilter) ??
    DEFAULT_CATALOGUE_STATE.statusFilter;

  return {
    query,
    category,
    onlyFirstSigns: stored.onlyFirstSigns === true,
    statusFilter,
  };
}

/** Whether this is the state a first-time visitor arrives with. */
export function isDefaultCatalogueState(state: CatalogueState): boolean {
  return (
    state.query === DEFAULT_CATALOGUE_STATE.query &&
    state.category === DEFAULT_CATALOGUE_STATE.category &&
    state.onlyFirstSigns === DEFAULT_CATALOGUE_STATE.onlyFirstSigns &&
    state.statusFilter === DEFAULT_CATALOGUE_STATE.statusFilter
  );
}

/**
 * Wraps filter state for storage, preserving whatever else is on the entry.
 *
 * The envelope is merged into the existing state rather than replacing it, so
 * this never becomes the reason some other feature's history data disappears.
 */
export function writeCatalogueState(
  existing: unknown,
  state: CatalogueState,
): Record<string, unknown> {
  const base = typeof existing === 'object' && existing !== null ? { ...existing } : {};
  return { ...base, [CATALOGUE_STATE_KEY]: state };
}

// --- Browser wiring --------------------------------------------------------

/**
 * How long after the last change the entry is rewritten.
 *
 * Not about history pollution — `replaceState` never adds an entry — but about
 * a hard browser limit: Safari throws a `SecurityError` after roughly 100
 * history writes in 30 seconds, and typing a word is one change per keystroke.
 * Coalescing a burst into a single write keeps this comfortably under it while
 * staying far shorter than the time it takes to read a card and tap it.
 */
const WRITE_DELAY_MS = 300;

function currentState(): CatalogueState {
  return {
    query: $query.get(),
    category: $category.get(),
    onlyFirstSigns: $onlyFirstSigns.get(),
    statusFilter: $statusFilter.get(),
  };
}

function applyCatalogueState(state: CatalogueState): void {
  $query.set(state.query);
  $category.set(state.category);
  $onlyFirstSigns.set(state.onlyFirstSigns);
  $statusFilter.set(state.statusFilter);
}

/**
 * Restores the filters this history entry was left with, and keeps writing them
 * back as they change. Returns a cleanup function.
 *
 * Call it **before** mounting the grid: restoring first means the controller's
 * opening pass already filters to the right cards, instead of showing all 194
 * and correcting itself a frame later.
 */
export function mountCatalogueHistory(): () => void {
  const restored = readCatalogueState(window.history.state);
  if (restored !== null && !isDefaultCatalogueState(restored)) {
    applyCatalogueState(restored);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  function persist(): void {
    timer = undefined;
    try {
      window.history.replaceState(
        writeCatalogueState(window.history.state, currentState()),
        '',
        // Same document, same address: the URL is deliberately not part of this.
        // See the note at the top of this file — a query string here would hand
        // the visitor's search terms to the analytics script.
        window.location.href,
      );
    } catch {
      // Over a browser's history-write allowance, or a sandboxed document that
      // refuses history at all. Remembering the filters is a convenience; it is
      // never worth breaking the catalogue over.
    }
  }

  function schedule(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(persist, WRITE_DELAY_MS);
  }

  const unsubscribers = [
    // nanostores calls a new subscriber immediately, which would write the
    // defaults over a state we have just restored. `listen` skips that first
    // call and reports only real changes.
    $query.listen(schedule),
    $category.listen(schedule),
    $onlyFirstSigns.listen(schedule),
    $statusFilter.listen(schedule),
  ];

  /**
   * An in-page anchor — the skip link, the bypass link — pushes a fresh entry
   * whose state is null. Without this, filtering, then jumping to the content,
   * then opening a sign and coming back would land on that empty entry and lose
   * everything. Writing immediately makes every entry we end up on carry the
   * filters that were on screen when it was created.
   */
  function onHashChange(): void {
    persist();
  }

  window.addEventListener('hashchange', onHashChange);

  return () => {
    window.removeEventListener('hashchange', onHashChange);
    if (timer !== undefined) clearTimeout(timer);
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

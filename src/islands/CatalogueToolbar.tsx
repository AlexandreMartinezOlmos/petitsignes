import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useStore } from '@nanostores/react';
import { createTranslator } from '../lib/i18n.ts';
import {
  $category,
  $hasActiveFilters,
  $onlyFirstSigns,
  $query,
  $statusFilter,
  $visibleCount,
  clearFilters,
  hydrateFromStorage,
  type StatusFilter,
} from '../lib/stores.ts';
import type { CategoryId, Language } from '../lib/types.ts';

interface CategoryOption {
  id: CategoryId;
  label: string;
}

interface Props {
  categories: CategoryOption[];
  language: Language;
  /** Total rendered at build time, shown until the grid controller reports. */
  initialCount: number;
}

/**
 * Each filter's label is `filter.<value>`, so the value alone is enough — a
 * parallel key field could only ever drift from it. `src/lib/i18n.test.ts`
 * pins the fact that every value here has a message.
 */
const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'favorites', 'learned', 'pending'];

/** Matches the `sm` breakpoint the card layout switches at. */
const WIDE_SCREEN = '(min-width: 40rem)';

export default function CatalogueToolbar({ categories, language, initialCount }: Props) {
  const t = createTranslator(language);

  const query = useStore($query);
  const category = useStore($category);
  const onlyFirstSigns = useStore($onlyFirstSigns);
  const statusFilter = useStore($statusFilter);
  const reportedCount = useStore($visibleCount);
  const visibleCount = reportedCount < 0 ? initialCount : reportedCount;
  const hasActiveFilters = useStore($hasActiveFilters);

  const searchInput = useRef<HTMLInputElement>(null);

  // Collapsing the category list buys back vertical space on a phone. On a
  // wide screen the full list is two lines, so hiding it would cost a click
  // and save nothing — it starts open there instead.
  //
  // `useSyncExternalStore` rather than reading `matchMedia` during render: the
  // page is built once at build time, so a viewport-dependent first render is
  // the hydration mismatch this project keeps out of its components. The
  // server snapshot is `false`, and React reconciles to the real value.
  const wideScreen = useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE_SCREEN);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(WIDE_SCREEN).matches,
    () => false,
  );

  // Null while the visitor has not expressed a preference, so the viewport
  // decides; once they open or close it by hand, that wins and a resize does
  // not undo it.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const categoriesOpen = openOverride ?? wideScreen;

  // Collapsed, the list still has to show the category doing the filtering —
  // otherwise picking one and scrolling on leaves the catalogue visibly cut
  // down with no on-screen explanation of why.
  const shownCategories = categoriesOpen
    ? categories
    : categories.filter((option) => option.id === category);

  useEffect(() => {
    void hydrateFromStorage();
  }, []);

  return (
    <div className="toolbar">
      <div className="mx-auto max-w-6xl px-4 pb-3">
        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <label className="sr-only" htmlFor="sign-search">
              {t('search.label')}
            </label>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="text-ink-muted pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="sign-search"
              ref={searchInput}
              type="search"
              inputMode="search"
              autoComplete="off"
              value={query}
              onChange={(event) => $query.set(event.target.value)}
              placeholder={t('search.placeholder')}
              className="search-field"
            />
            {query !== '' && (
              <button
                type="button"
                onClick={() => {
                  $query.set('');
                  searchInput.current?.focus();
                }}
                aria-label={t('search.clear')}
                className="text-ink-muted hover:text-ink absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/*
          Everything past the search field collapses while scrolling down the
          catalogue. On a 375px screen the header was 261px — a third of the
          viewport permanently occupied by chrome — and these two rows are most
          of it. Search stays: it is the fastest way to reach a specific sign,
          and it is one row.

          The rows are hidden, not just shrunk, so their controls leave the tab
          order rather than becoming invisible focus traps. `:focus-within` on
          the header keeps them open whenever focus is anywhere inside it, so a
          keyboard user filtering the grid never has the controls close under
          them.
        */}
        <div className="toolbar__filters">
          {/* The animation clips against this wrapper, so the rows below can be
              any height without a ceiling to outgrow. */}
          <div className="toolbar__filters-inner">
            {/*
            Categories wrap and are collapsed by default rather than sitting in
            a horizontally scrolling row. Measured on a 375px screen, that row
            showed 3 of 17 chips and hid the rest behind five screens of
            sideways scrolling: you could not find out that "Animals" existed
            without swiping blind. Showing all of them instead costs six lines,
            308px, a third of the viewport — which is why they were put in a
            scroller in the first place.

            So: collapsed shows the two entry points plus whichever category is
            actually filtering, and the button says how many more there are.
            Expanded wraps all of them into a block that can be read at a
            glance. The hidden chips are not rendered rather than clipped, so
            there is never a control that is invisible but still tabbable.
          */}
            <div className="chip-row mt-3" role="group" aria-label={t('filter.categories')}>
              <button
                type="button"
                onClick={() => {
                  $category.set(null);
                  $onlyFirstSigns.set(false);
                }}
                aria-pressed={category === null && !onlyFirstSigns}
                className="chip"
              >
                {t('filter.all')}
              </button>

              <button
                type="button"
                onClick={() => {
                  $onlyFirstSigns.set(!onlyFirstSigns);
                  $category.set(null);
                }}
                aria-pressed={onlyFirstSigns}
                className="chip"
              >
                ⭐ {t('filter.firstSigns')}
              </button>

              {shownCategories.map((option) => {
                const active = category === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      $category.set(active ? null : option.id);
                      $onlyFirstSigns.set(false);
                      // Choosing one answers the question the list was open for.
                      setOpenOverride(false);
                    }}
                    aria-pressed={active}
                    className="chip"
                  >
                    {option.label}
                  </button>
                );
              })}

              {/* Short label, full accessible name: spelled out, the chip wrapped
                onto a second line and cost 48px in the resting state that this
                whole change exists to protect. */}
              <button
                type="button"
                onClick={() => setOpenOverride(!categoriesOpen)}
                aria-expanded={categoriesOpen}
                aria-label={
                  categoriesOpen
                    ? t('filter.hideCategories')
                    : t('filter.showCategoriesLabel', { count: categories.length })
                }
                className="chip chip--more"
              >
                {categoriesOpen
                  ? t('filter.hideCategories')
                  : t('filter.showCategories', { count: categories.length })}
              </button>
            </div>

            {/* Status filters + live result count */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* Its own label: two groups called "Categories" are indistinguishable
              when navigating by region, and axe cannot catch that — both had a
              label, they were just the wrong one. */}
              <div className="flex gap-1" role="group" aria-label={t('filter.status')}>
                {STATUS_FILTERS.map((value) => {
                  const active = statusFilter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => $statusFilter.set(value)}
                      aria-pressed={active}
                      className="chip-quiet"
                    >
                      {t(`filter.${value}`)}
                    </button>
                  );
                })}
              </div>

              <p className="text-ink-muted ms-auto text-sm" aria-live="polite">
                {visibleCount === 1
                  ? t('search.resultCountOne')
                  : t('search.resultCount', { count: visibleCount })}
              </p>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-brand-ink min-h-9 text-sm font-medium underline underline-offset-2"
                >
                  {t('filter.clear')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

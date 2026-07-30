import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { createTranslator } from '../lib/i18n.ts';
import { isSearchable } from '../lib/search.ts';
import {
  $category,
  $hasActiveFilters,
  $onlyFirstSigns,
  $query,
  $statusFilter,
  $visibleCount,
  clearFilters,
  hydrateFromStorage,
  STATUS_FILTERS,
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

  /**
   * A search is a global lookup: `filterCards` deliberately ignores the
   * category chips so that finding a word never depends on which chip happens
   * to be selected. Nothing un-pressed them, though, so the toolbar claimed a
   * filter it was not applying — `⭐ Primers signes` stayed `aria-pressed`
   * while the results included signs that are not first signs. Same lie to the
   * eye and to the screen reader.
   *
   * The stored choice is kept, not cleared: clearing it would be destructive,
   * and this way the chip lights up again the moment the search is emptied.
   * `isSearchable`, not a non-empty string, so the toolbar's idea of "a search
   * is running" is exactly the grid's.
   */
  const searchActive = isSearchable(query);
  const filtersSuspended = searchActive && (category !== null || onlyFirstSigns);

  /**
   * What the live region announces after the count. "22 signes" alone is a
   * number with no subject: correct, and useless to anyone who cannot see
   * which chip is lit. Visually the chips already say it, so this rides along
   * as screen-reader-only text rather than costing a line of the header.
   */
  const scopeParts = [
    searchActive ? t('search.scopeSearch', { query: query.trim() }) : null,
    !searchActive && onlyFirstSigns ? t('filter.firstSigns') : null,
    !searchActive ? (categories.find((option) => option.id === category)?.label ?? null) : null,
    statusFilter !== 'all' ? t(`filter.${statusFilter}`) : null,
  ].filter((part): part is string => part !== null);

  const scope = scopeParts.length > 0 ? scopeParts.join(' · ') : t('search.scopeAll');

  // Closed everywhere, not just on phones. Opening it on a wide screen and
  // then collapsing it the moment a category was picked meant the control
  // behaved one way on arrival and another way for the rest of the visit —
  // the same list, two different rules. One rule is easier to trust, and the
  // toolbar keeps its resting height on every screen.
  const [categoriesOpen, setCategoriesOpen] = useState(false);

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
      <div className="toolbar__inner shell pb-3">
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
            <div
              className="toolbar__categories chip-row mt-3"
              role="group"
              aria-label={t('filter.categories')}
            >
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
                aria-pressed={onlyFirstSigns && !searchActive}
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
                      setCategoriesOpen(false);
                    }}
                    aria-pressed={active && !searchActive}
                    className="chip"
                  >
                    {option.label}
                  </button>
                );
              })}

              {/*
                The accessible name **begins with the visible text**, then
                explains it: "+15 més: mostra totes les categories".

                It used to announce "Mostra les 15 categories" while showing
                "+15 més", which fails WCAG 2.5.3 (Label in Name, level A) —
                someone driving the page by voice says what they can see, and
                "més" matched nothing. Spelling the label out in full instead
                fixed that but pushed the chips onto a second row at 360px, a
                very common phone width, costing 52px of a header that is
                already too tall. Leading with the visible text satisfies the
                criterion and keeps the row at one line, so long as the rule is
                respected: whatever `filter.showCategories` says, the label
                string has to start with it. `i18n.test.ts` pins that.
              */}
              <button
                type="button"
                onClick={() => setCategoriesOpen(!categoriesOpen)}
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
            <div className="toolbar__status mt-2 flex flex-wrap items-center gap-2">
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
                <span className="sr-only"> · {scope}</span>
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

            {/* Only while the chips are actually suspended, which is rare —
                so it explains the un-pressing without costing height the rest
                of the time. */}
            {filtersSuspended && <p className="toolbar__note">{t('filter.searchScope')}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
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

        {/* Category chips */}
        <div
          className="chip-row -mx-4 mt-3 px-4 pb-1"
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
            aria-pressed={onlyFirstSigns}
            className="chip"
          >
            ⭐ {t('filter.firstSigns')}
          </button>

          {categories.map((option) => {
            const active = category === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  $category.set(active ? null : option.id);
                  $onlyFirstSigns.set(false);
                }}
                aria-pressed={active}
                className="chip"
              >
                {option.label}
              </button>
            );
          })}
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
  );
}

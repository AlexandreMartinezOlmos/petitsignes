/**
 * What the catalogue says when a filter leaves it empty.
 *
 * The reason matters more than the fact: an empty "favourites" filter is an
 * invitation to start, an empty "pending" filter is a milestone, and a search
 * that found nothing is neither. Kept free of the DOM so the choice can be
 * tested; the page script only renders what this returns.
 *
 * The strings reach the page script through the element's `data-messages`,
 * picked at build time in the page's language: importing the dictionaries
 * here would ship all three languages to every visitor (see `translate.ts`).
 */

import type { MessageKey } from './i18n.ts';
import { isSearchable } from './search.ts';
import type { StatusFilter } from './stores.ts';

export const EMPTY_STATE_MESSAGES = [
  'empty.generic.title',
  'empty.generic.hint',
  'empty.search.title',
  'empty.search.hint',
  'empty.favorites.title',
  'empty.favorites.hint',
  'empty.learned.title',
  'empty.learned.hint',
  'empty.pending.title',
  'empty.pending.hint',
] as const satisfies readonly MessageKey[];

export type EmptyStateMessage = (typeof EMPTY_STATE_MESSAGES)[number];

export interface EmptyState {
  emoji: string;
  title: EmptyStateMessage;
  hint: EmptyStateMessage;
}

export function emptyStateFor(query: string, status: StatusFilter): EmptyState {
  // Same gate as the filter (`isSearchable`, not `!== ''`), or a query too
  // short to search would blame the empty grid on a search that never ran.
  if (isSearchable(query.trim())) {
    return { emoji: '🔍', title: 'empty.search.title', hint: 'empty.search.hint' };
  }

  switch (status) {
    case 'favorites':
      return { emoji: '💛', title: 'empty.favorites.title', hint: 'empty.favorites.hint' };
    case 'learned':
      return { emoji: '🌱', title: 'empty.learned.title', hint: 'empty.learned.hint' };
    case 'pending':
      return { emoji: '🎉', title: 'empty.pending.title', hint: 'empty.pending.hint' };
    case 'all':
      return { emoji: '🤷', title: 'empty.generic.title', hint: 'empty.generic.hint' };
  }
}

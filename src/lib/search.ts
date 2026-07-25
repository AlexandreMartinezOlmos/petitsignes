/**
 * Client-side search.
 *
 * Accent- and case-insensitive, partial matches, and it looks in every
 * interface language at once so "llet", "leche" and "milk" all find the entry.
 */

import Fuse, { type IFuseOptions } from 'fuse.js';
import { LANGUAGES, type CategoryId, type Language, type LocalizedText } from './types.ts';

export interface SearchableSign {
  id: string;
  labels: LocalizedText;
  category: CategoryId;
}

/** Fuse searches these pre-normalised fields, never the raw labels. */
interface IndexedSign extends SearchableSign {
  normalized: Record<Language, string>;
}

/**
 * Strips diacritics and lowercases, so "plàtan" and "platano" both reduce to a
 * comparable form. NFD splits a letter from its accent; the range then removes
 * the accent marks.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Shortest query the index will answer. A single character matches too much to
 * be useful at this threshold, so anything shorter is treated as "no search
 * yet" rather than "no results" — see `isSearchable`.
 *
 * Callers must gate on `isSearchable` instead of on a non-empty string: this
 * constant and the caller's idea of "the visitor is searching" have to be the
 * same thing, or the first keystroke of every search empties the catalogue.
 */
export const MIN_QUERY_LENGTH = 2;

const FUSE_OPTIONS: IFuseOptions<IndexedSign> = {
  keys: LANGUAGES.map((language) => `normalized.${language}`),
  // Low threshold: parents search for a word they know, so a near-exact match
  // is what they expect. Higher values start returning unrelated signs.
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: MIN_QUERY_LENGTH,
};

/** Whether a query is long enough for the index to answer it meaningfully. */
export function isSearchable(query: string): boolean {
  return normalizeText(query).length >= MIN_QUERY_LENGTH;
}

export function createSearchIndex(signs: SearchableSign[]): Fuse<IndexedSign> {
  const indexed: IndexedSign[] = signs.map((sign) => ({
    ...sign,
    normalized: Object.fromEntries(
      LANGUAGES.map((language) => [language, normalizeText(sign.labels[language])]),
    ) as Record<Language, string>,
  }));

  return new Fuse(indexed, FUSE_OPTIONS);
}

/**
 * Returns matching sign ids, best first. A query shorter than
 * `MIN_QUERY_LENGTH` returns an empty array: the caller decides what "no
 * search" means (usually: show everything).
 */
export function searchSigns(index: Fuse<IndexedSign>, query: string, limit = 50): string[] {
  if (!isSearchable(query)) return [];

  return index.search(normalizeText(query), { limit }).map((result) => result.item.id);
}

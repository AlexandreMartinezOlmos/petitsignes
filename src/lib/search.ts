/**
 * Client-side search (docs/requisitos.md §4.3).
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

const FUSE_OPTIONS: IFuseOptions<IndexedSign> = {
  keys: LANGUAGES.map((language) => `normalized.${language}`),
  // Low threshold: parents search for a word they know, so a near-exact match
  // is what they expect. Higher values start returning unrelated signs.
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

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
 * Returns matching sign ids, best first. An empty query returns an empty array:
 * the caller decides what "no search" means (usually: show everything).
 */
export function searchSigns(index: Fuse<IndexedSign>, query: string, limit = 50): string[] {
  const normalized = normalizeText(query);
  if (normalized.length === 0) return [];

  return index.search(normalized, { limit }).map((result) => result.item.id);
}

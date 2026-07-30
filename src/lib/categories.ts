/**
 * Where a category lives when it lives on its own.
 *
 * Between the catalogue and a sign there was nothing: 194 concepts at one
 * address, then 194 addresses with one concept each, and no step in between.
 * "Signes de menjar per a nadons" is as real a search as "com es signa llet",
 * and it had no page to answer it.
 *
 * These pages are also what make the catalogue walkable. Every sign links up to
 * its category, every category links across to the others, so a crawler that
 * finds one entry can reach the rest without going back to the index.
 */

import { CATEGORY_IDS, type CategoryId } from './types.ts';

export const CATEGORY_PATH_PREFIX = '/categoria/';

/**
 * The public address of each category, in Catalan, the same in both locales.
 *
 * Two decisions are baked in here, and both were argued before being written.
 *
 * **Catalan rather than the id.** The ids are English because they are code —
 * a TypeScript union, a `data-category` attribute, a Zod enum — and §5 of
 * `CLAUDE.md` asks that of identifiers. None of that says anything about what
 * belongs in an address. The site's own convention is a single slug shared by
 * both locales (`/el-projecte/`, `/accessibilitat/`), and the language of that
 * slug has never been English.
 *
 * **Written out rather than derived from the labels.** Generating
 * `menjar-i-beure` from "Menjar i beure" would tie a permanent public URL to a
 * piece of editable copy: rewording a label to read better on a chip would
 * silently break every link anyone had shared. Same reasoning that keeps a
 * sign's id stable while its labels stay free to change — except a category
 * slug is not even stored anywhere else, so this map is the only thing making
 * the promise. Changing a value here breaks links; changing a label does not.
 */
export const CATEGORY_SLUGS: Record<CategoryId, string> = {
  food: 'menjar-i-beure',
  routines: 'rutines-i-cura',
  family: 'persones-i-familia',
  emotions: 'emocions',
  animals: 'animals',
  objects: 'objectes-i-joguines',
  actions: 'accions',
  qualities: 'qualitats',
  nature: 'natura-i-exterior',
  courtesy: 'cortesia',
  body: 'cos',
  clothing: 'roba',
  colors: 'colors',
  numbers: 'numeros',
  time: 'temps-i-conceptes',
};

/** Locale-independent path of a category's page, for `localeHref`. */
export function categoryPath(id: CategoryId): string {
  return `${CATEGORY_PATH_PREFIX}${CATEGORY_SLUGS[id]}/`;
}

/** Every category's path, in the order given. Feeds the sitemap. */
export function categoryPaths(ids: readonly CategoryId[] = CATEGORY_IDS): string[] {
  return ids.map(categoryPath);
}

/** The category a slug names, or null. Used to build the static routes. */
export function categoryIdFromSlug(slug: string): CategoryId | null {
  return CATEGORY_IDS.find((id) => CATEGORY_SLUGS[id] === slug) ?? null;
}

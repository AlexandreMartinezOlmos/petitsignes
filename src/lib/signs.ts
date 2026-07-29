/**
 * Where a sign lives when it lives on its own.
 *
 * The catalogue publishes 194 concepts on a single page, which is one address
 * for 194 things: a search engine cannot offer "how do you sign milk in LSC"
 * because no page claims to be about milk. These helpers give each concept its
 * own URL and decide what surrounds it there.
 *
 * The path is built from the sign's `id`, which is also the key `localStorage`
 * saves favourites under (§4.1 of `CLAUDE.md`). That was already a reason not to
 * rename one; now it is two, because a rename breaks external links as well.
 */

import type { Language, SignEntry } from './types.ts';

/**
 * Catalan, in both locales, exactly like `/el-projecte/` and `/accessibilitat/`.
 *
 * The alternative — `/signe/` against `/es/signo/` — would mean the two locales
 * no longer share a locale-independent path, and `localeHref` is what every
 * canonical link, `hreflang` alternate and sitemap entry is derived from. One
 * translated segment would cost all three.
 */
export const SIGN_PATH_PREFIX = '/signe/';

/**
 * The shape an id has to have to survive being put in a URL.
 *
 * Lowercase ASCII, digits and single hyphens. Anything else — an accent, a
 * space, an uppercase letter — either gets percent-encoded into an address
 * nobody can read aloud or makes two ids collide on a case-insensitive
 * filesystem. There is a test that holds every id in the collection to this.
 */
const SIGN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSignSlug(id: string): boolean {
  return SIGN_SLUG.test(id);
}

/** Locale-independent path of a sign's page, for `localeHref`. */
export function signPath(id: string): string {
  return `${SIGN_PATH_PREFIX}${id}/`;
}

/** Every sign's path, in the order given. Feeds the sitemap. */
export function signPaths(ids: readonly string[]): string[] {
  return ids.map(signPath);
}

/**
 * How many neighbours a sign page offers.
 *
 * Six is two rows of three on a desktop and six taps on a phone. It is also the
 * point past which the list stops being a suggestion and becomes a second
 * catalogue — which already exists, one link away.
 */
export const RELATED_SIGNS_LIMIT = 6;

/**
 * The other signs in the same category, alphabetically, minus this one.
 *
 * A page with one word and one video is a dead end: the visitor either goes back
 * or leaves. These are the cheapest honest way onward, and they are what turns
 * 194 orphan pages into a catalogue a crawler can actually walk — every sign
 * ends up reachable from several others rather than only from the index.
 *
 * Sorted by the label in the interface language, so the Catalan and Spanish
 * pages of the same sign can legitimately offer different neighbours: `llet`
 * and `leche` do not sit in the same place in their own alphabets.
 */
export function relatedSigns(
  sign: SignEntry,
  all: readonly SignEntry[],
  language: Language,
  limit: number = RELATED_SIGNS_LIMIT,
): SignEntry[] {
  return all
    .filter((other) => other.id !== sign.id && other.category === sign.category)
    .sort((a, b) => a.labels[language].localeCompare(b.labels[language], language))
    .slice(0, limit);
}

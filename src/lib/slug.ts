/**
 * The shape a path segment has to have to survive being a public address.
 *
 * Lowercase ASCII, digits and single hyphens. Anything else — an accent, a
 * space, an uppercase letter — either gets percent-encoded into an address
 * nobody can read aloud or makes two segments collide on a case-insensitive
 * filesystem.
 *
 * Shared by the two things that put a segment in a URL: a sign's id and a
 * category's slug. Each has a test holding its whole set to this.
 */
const URL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isUrlSlug(value: string): boolean {
  return URL_SLUG.test(value);
}

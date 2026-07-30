import { describe, expect, it } from 'vitest';
import {
  CATEGORY_PATH_PREFIX,
  CATEGORY_SLUGS,
  categoryIdFromSlug,
  categoryPath,
  categoryPaths,
} from './categories.ts';
import { isUrlSlug } from './slug.ts';
import { CATEGORY_IDS } from './types.ts';

describe('category slugs', () => {
  /**
   * A category with no slug would build a path of `undefined`, and the page
   * would either fail to generate or answer at `/categoria/undefined/`. The
   * record's type already forces this, but the type is erased at runtime and a
   * category added through a merge is exactly the case that slips through.
   */
  it('covers every category, with nothing left over', () => {
    expect(Object.keys(CATEGORY_SLUGS).sort()).toEqual([...CATEGORY_IDS].sort());
  });

  /**
   * These are public addresses. An accent or a capital either percent-encodes
   * into something nobody can read out loud or collides with a sibling on a
   * case-insensitive filesystem.
   */
  it('are all safe to put in a URL', () => {
    const bad = Object.values(CATEGORY_SLUGS).filter((slug) => !isUrlSlug(slug));
    expect(bad).toEqual([]);
  });

  it('are all different', () => {
    const slugs = Object.values(CATEGORY_SLUGS);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  /**
   * Not a style rule. The ids are English because they are code; an address is
   * not code, and the site's other pages (`/el-projecte/`, `/accessibilitat/`)
   * are Catalan in both locales.
   *
   * Spot-checked rather than derived, because the only general form of this rule
   * — "no slug equals its id" — is simply false: `animals` and `colors` are
   * spelled the same in Catalan and in English. That coincidence is not an
   * identifier leaking into a URL, and a test that called it one would be
   * demanding a worse slug to satisfy itself.
   */
  it('are Catalan words rather than the English identifiers', () => {
    expect(CATEGORY_SLUGS.food).toBe('menjar-i-beure');
    expect(CATEGORY_SLUGS.body).toBe('cos');
    expect(CATEGORY_SLUGS.clothing).toBe('roba');
    expect(CATEGORY_SLUGS.numbers).toBe('numeros');
    expect(CATEGORY_SLUGS.time).toBe('temps-i-conceptes');
  });

  /**
   * Accents are what the slug rule above would otherwise let through unnoticed:
   * "família" and "números" both carry one, and percent-encoding it produces an
   * address nobody can read out or type.
   */
  it('strip the accents the labels carry', () => {
    expect(CATEGORY_SLUGS.family).toBe('persones-i-familia');
    expect(CATEGORY_SLUGS.numbers).not.toContain('ú');
  });
});

describe('category paths', () => {
  it('builds a locale-independent path with a trailing slash', () => {
    expect(categoryPath('food')).toBe('/categoria/menjar-i-beure/');
    expect(categoryPath('food').startsWith(CATEGORY_PATH_PREFIX)).toBe(true);
    expect(categoryPath('numbers').endsWith('/')).toBe(true);
  });

  it('lists every category by default, in declaration order', () => {
    const paths = categoryPaths();
    expect(paths).toHaveLength(CATEGORY_IDS.length);
    expect(paths[0]).toBe(categoryPath(CATEGORY_IDS[0]));
  });
});

describe('reading a slug back', () => {
  /**
   * The routes are generated from the map and the incoming slug is matched
   * against it, so a mismatch between the two directions would publish pages at
   * addresses that then answer with nothing.
   */
  it('round-trips every category', () => {
    for (const id of CATEGORY_IDS) {
      expect(categoryIdFromSlug(CATEGORY_SLUGS[id])).toBe(id);
    }
  });

  it('refuses anything that is not a slug we publish', () => {
    expect(categoryIdFromSlug('food')).toBeNull();
    expect(categoryIdFromSlug('menjar')).toBeNull();
    expect(categoryIdFromSlug('')).toBeNull();
    expect(categoryIdFromSlug('MENJAR-I-BEURE')).toBeNull();
  });
});

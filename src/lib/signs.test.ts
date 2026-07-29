import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELATED_SIGNS_LIMIT, isSignSlug, relatedSigns, signPath, signPaths } from './signs.ts';
import type { SignEntry } from './types.ts';

function sign(id: string, category: SignEntry['category'], labels: Partial<SignEntry['labels']>) {
  return {
    id,
    category,
    isFirstSign: false,
    labels: { ca: id, es: id, en: id, ...labels },
    videos: [],
  } satisfies SignEntry;
}

describe('signPath', () => {
  it('is the same path in both locales, like every other page', () => {
    // `localeHref` prefixes; it does not translate. A `/signo/` for Spanish
    // would mean the two locales no longer share a locale-independent path, and
    // the canonical link, the hreflang alternates and the sitemap are all
    // derived from exactly that.
    expect(signPath('leche')).toBe('/signe/leche/');
  });

  it('ends in a slash, so the built page is a directory like the rest', () => {
    expect(signPath('agua').endsWith('/')).toBe(true);
  });

  it('maps a whole collection in order', () => {
    expect(signPaths(['agua', 'leche'])).toEqual(['/signe/agua/', '/signe/leche/']);
  });
});

describe('isSignSlug', () => {
  it('accepts the shape the ids actually have', () => {
    expect(isSignSlug('leche')).toBe(true);
    expect(isSignSlug('una-otra-vez')).toBe(true);
    expect(isSignSlug('numero-2')).toBe(true);
  });

  it('rejects anything that would not survive being a URL', () => {
    expect(isSignSlug('Leche')).toBe(false);
    expect(isSignSlug('café')).toBe(false);
    expect(isSignSlug('dos palabras')).toBe(false);
    expect(isSignSlug('-leche')).toBe(false);
    expect(isSignSlug('leche-')).toBe(false);
    expect(isSignSlug('leche--fria')).toBe(false);
    expect(isSignSlug('')).toBe(false);
  });
});

/**
 * Read off disk rather than through the content collection, the same way
 * `color.test.ts` reads `global.css`: the filename is what becomes the id, and
 * the id is what becomes the URL. Checking the bytes that ship is the only way
 * this catches a file added by hand.
 */
describe('every sign in the catalogue', () => {
  // From the project root, like `color.test.ts`: under jsdom `import.meta.url`
  // is an http URL and cannot be turned into a path.
  const dir = resolve(process.cwd(), 'src/content/signs');
  const ids = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length));

  it('is there at all', () => {
    expect(ids.length).toBeGreaterThan(100);
  });

  it('has an id that can be a URL without being encoded', () => {
    // An accent or a capital here would either produce an address nobody can
    // read aloud or collide with another id on a case-insensitive filesystem.
    // And an id is not free to change afterwards: `localStorage` saves
    // favourites under it, so a rename now also breaks every external link.
    expect(ids.filter((id) => !isSignSlug(id))).toEqual([]);
  });
});

describe('relatedSigns', () => {
  const leche = sign('leche', 'food', { ca: 'llet', es: 'leche' });
  const agua = sign('agua', 'food', { ca: 'aigua', es: 'agua' });
  const pan = sign('pan', 'food', { ca: 'pa', es: 'pan' });
  const perro = sign('perro', 'animals', { ca: 'gos', es: 'perro' });
  const catalogue = [leche, agua, pan, perro];

  it('offers the rest of the category and never the sign itself', () => {
    const related = relatedSigns(leche, catalogue, 'es');

    expect(related.map((item) => item.id)).toEqual(['agua', 'pan']);
  });

  it('sorts by the label of the page it is on, not by the id', () => {
    // The neighbours of `agua` are `leche` and `pan` by id, but `llet` and `pa`
    // in Catalan — and in Catalan `llet` comes first, which the id order does
    // not give you. The two locales of one sign legitimately differ here.
    const related = relatedSigns(agua, catalogue, 'ca');

    expect(related.map((item) => item.labels.ca)).toEqual(['llet', 'pa']);
  });

  it('stops at the limit rather than reprinting the catalogue', () => {
    const first = sign('w0', 'food', { es: 'w0' });
    const many = [
      first,
      ...Array.from({ length: 19 }, (_, index) =>
        sign(`w${index + 1}`, 'food', { es: `w${index + 1}` }),
      ),
    ];

    expect(relatedSigns(first, many, 'es')).toHaveLength(RELATED_SIGNS_LIMIT);
  });

  it('returns nothing for the only sign in its category', () => {
    expect(relatedSigns(perro, catalogue, 'es')).toEqual([]);
  });
});

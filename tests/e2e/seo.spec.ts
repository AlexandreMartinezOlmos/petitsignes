import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { createTranslator } from '../../src/lib/i18n.ts';
import { TITLE_MAX_LENGTH } from '../../src/lib/seo.ts';
import { LANGUAGE_TO_SIGN_LANGUAGE, type SignEntry } from '../../src/lib/types.ts';

/** A sign as its JSON file holds it: the entry without the id, which is the filename. */
type SignData = Omit<SignEntry, 'id'>;

/**
 * What every page tells a search engine, read from the build that ships.
 *
 * None of this is visible on the page, which is the reason it is checked here
 * and not by eye: a title that lost its sign language or collided with another
 * page's renders perfectly, passes axe and Lighthouse, and costs nothing until
 * someone searches. The files are read off disk rather than loaded in a browser
 * because the head is static — there is nothing to run — and because all 428
 * pages can be checked in the time it takes to open a handful.
 */

const DIST = resolve(process.cwd(), 'dist');
const SITE_NAME = 'Petits Signes';

type Kind = 'home' | 'category' | 'sign' | 'text' | 'not-found';

interface BuiltPage {
  /** The URL path, `/es/signe/leche/`. */
  path: string;
  locale: 'ca' | 'es';
  kind: Kind;
  title: string;
  description: string;
  noindex: boolean;
}

/** Astro escapes these five in text and attributes; nothing else appears. */
function decode(value: string): string {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function kindOf(path: string): Kind {
  const bare = path.replace(/^\/es\//, '/');
  if (bare === '/') return 'home';
  if (bare.startsWith('/categoria/')) return 'category';
  if (bare.startsWith('/signe/')) return 'sign';
  if (bare === '/404.html') return 'not-found';
  return 'text';
}

const PAGES: BuiltPage[] = htmlFiles(DIST).map((file) => {
  const html = readFileSync(file, 'utf8');
  const path = `/${relative(DIST, file).split(sep).join('/')}`.replace(/index\.html$/, '');

  return {
    path,
    locale: path.startsWith('/es/') ? 'es' : 'ca',
    kind: kindOf(path),
    title: decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''),
    description: decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''),
    noindex: /<meta name="robots" content="noindex/.test(html),
  };
});

const INDEXABLE = PAGES.filter((page) => !page.noindex);
const page = (path: string): BuiltPage => {
  const found = PAGES.find((candidate) => candidate.path === path);
  if (!found) throw new Error(`${path} is not in dist/ — did the build run?`);
  return found;
};

// The head is the same bytes whichever device asks for it, so reading it twice
// would only double the time the suite takes.
test.skip(({ isMobile }) => isMobile, 'the files on disk do not depend on the viewport');

test('the build is the one this spec expects', () => {
  // 2 × (4 text pages + 15 categories + 194 signs) + the two 404s. Not a
  // number to keep in step with the catalogue: it is here so that a spec
  // reading an empty or stale dist/ fails loudly instead of passing on nothing.
  expect(INDEXABLE.length).toBeGreaterThan(400);
});

test.describe('titles', () => {
  /**
   * The question a parent types is "signes per a nadons" or "llet en llengua
   * de signes", about one sign language. The title used to be the brand on
   * the home and the bare word on a sign ("llet · Petits Signes"), so neither
   * said which of the two sign languages the page teaches.
   */
  test('the home page says what it is in the words it is searched for', () => {
    expect(page('/').title).toBe('Signes per a nadons en llengua de signes catalana (LSC)');
    expect(page('/es/').title).toBe('Signos para bebés en lengua de signos española (LSE)');
  });

  test('a sign page is titled with the word and the sign language', () => {
    expect(page('/signe/leche/').title).toBe(
      '«llet» en llengua de signes catalana (LSC) · Petits Signes',
    );
    expect(page('/es/signe/leche/').title).toBe(
      '«leche» en lengua de signos española (LSE) · Petits Signes',
    );
  });

  test('a category page is titled with the category and the sign language', () => {
    expect(page('/categoria/animals/').title).toBe(
      'Signes d’animals en llengua de signes catalana (LSC)',
    );
    expect(page('/es/categoria/animals/').title).toBe(
      'Signos de animales en lengua de signos española (LSE)',
    );
  });

  /**
   * Each locale is its own build and teaches one sign language (ca → LSC,
   * es → LSE). A title naming the other one would promise a gesture the page
   * does not carry — the same false claim the page itself is built to never
   * make.
   */
  test('every catalogue page names its own sign language and never the other', () => {
    const own = { ca: '(LSC)', es: '(LSE)' } as const;
    const other = { ca: '(LSE)', es: '(LSC)' } as const;

    const content = INDEXABLE.filter((p) => ['home', 'category', 'sign'].includes(p.kind));
    expect(content.length).toBeGreaterThan(400);

    for (const { path, locale, title } of content) {
      expect(title, path).toContain(own[locale]);
      expect(title, path).not.toContain(other[locale]);
    }
  });

  /**
   * Two pages with the same title are two results a reader cannot tell apart,
   * and a search engine picks one and hides the other. It has happened here
   * once already: two concepts shared the label `llit`.
   */
  test('no two indexable pages share a title', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const { path, title } of INDEXABLE) {
      const first = seen.get(title);
      if (first) collisions.push(`${path} and ${first}: "${title}"`);
      else seen.set(title, path);
    }

    expect(collisions).toEqual([]);
  });

  /**
   * The site's name is only appended when there is room for it. If a title
   * carries it and is still too long, the rule in `documentTitle` has been
   * bypassed — and the part a search result cuts off is the end of the
   * sentence, where the sign language is.
   */
  test('a title only carries the site name when both fit before the cut', () => {
    const tooLong = PAGES.filter(
      (p) => p.title.endsWith(` · ${SITE_NAME}`) && [...p.title].length > TITLE_MAX_LENGTH,
    ).map((p) => `${p.path}: "${p.title}" (${[...p.title].length})`);

    expect(tooLong).toEqual([]);
  });
});

test.describe('descriptions', () => {
  /**
   * The window a search result shows the description in. Past about 160
   * characters it is cut mid-sentence — the project page ran to 350 and the
   * credits to 207, because both reused their opening paragraph. Under about
   * 70 it is too thin to say what the page holds: the home page's 61 was the
   * tagline and nothing else.
   */
  const MIN = 70;
  const MAX = 160;

  test('every indexable page has a description that fits the result it is shown in', () => {
    const outside = INDEXABLE.map((p) => ({ ...p, length: [...p.description].length }))
      .filter(({ length }) => length < MIN || length > MAX)
      .map(({ path, length }) => `${path}: ${length}`);

    expect(outside).toEqual([]);
  });

  test('no two indexable pages share a description', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const { path, description } of INDEXABLE) {
      const first = seen.get(description);
      if (first) collisions.push(`${path} and ${first}`);
      else seen.set(description, path);
    }

    expect(collisions).toEqual([]);
  });

  /**
   * The promise a result makes has to match what the page delivers. A Catalan
   * sign page embeds its video; a Spanish one links out to it at DILSE. All 194
   * Spanish descriptions said "con el vídeo de la fuente oficial" anyway.
   *
   * Read from the content rather than assumed per locale, so the day a sign
   * language gains an embed — or loses one — the expectation follows the data.
   */
  test('a sign page only promises a video it actually plays', () => {
    const signs = PAGES.filter((p) => p.kind === 'sign');
    expect(signs.length).toBeGreaterThan(380);

    for (const { path, locale, description } of signs) {
      const id = path.split('/').filter(Boolean).at(-1)!;
      const sign = JSON.parse(
        readFileSync(resolve(process.cwd(), 'src/content/signs', `${id}.json`), 'utf8'),
      ) as SignData;
      const signLanguage = LANGUAGE_TO_SIGN_LANGUAGE[locale];
      const video = sign.videos.find((v) => v.signLanguage === signLanguage);

      const t = createTranslator(locale);
      const values = {
        label: sign.labels[locale],
        signLanguage: t(signLanguage === 'lsc' ? 'signLanguage.lscFull' : 'signLanguage.lseFull'),
      };
      const promisesPlayback = description === t('sign.meta', values);

      expect(promisesPlayback, path).toBe(video?.delivery === 'youtube-embed');
    }
  });

  test('the Spanish sign page says the video is one link away', () => {
    expect(page('/es/signe/leche/').description).toBe(
      'Cómo se signa «leche» en Lengua de Signos Española, con el enlace a su vídeo en la fuente oficial.',
    );
  });

  test('the home page says how many signs it holds, in its own sign language', () => {
    expect(page('/').description).toMatch(
      /^\d+ signes reals de la llengua de signes catalana \(LSC\) /,
    );
    expect(page('/es/').description).toMatch(
      /^\d+ signos reales de la lengua de signos española \(LSE\) /,
    );
  });
});

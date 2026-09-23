import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * `/_astro/*` is served as immutable for a year (see `public/_headers`). That
 * is only safe because every file there is named after a hash of its contents,
 * so a changed file arrives under a new name. The day the build writes one
 * plain name into that directory — a config change, a plugin, an asset copied
 * in by hand — visitors would keep the old file for a year. This reads the
 * directory that ships and the header file as the build left it.
 */

const DIST = resolve(process.cwd(), 'dist');

test.skip(({ isMobile }) => isMobile, 'the files on disk do not depend on the viewport');

test('every file the immutable rule covers is named after its contents', () => {
  const files = readdirSync(resolve(DIST, '_astro'));
  expect(files.length).toBeGreaterThan(0);

  // Vite's content hash: eight URL-safe characters before the extension.
  const unhashed = files.filter((name) => !/\.[\w-]{8}\.[a-z0-9]+$/i.test(name));
  expect(unhashed).toEqual([]);
});

/**
 * The build rewrites `_headers` to inject the CSP. The rule has to survive that
 * step, or the source file promises a cache the site never sends.
 */
test('the built headers still carry the rule', () => {
  const headers = readFileSync(resolve(DIST, '_headers'), 'utf8');
  expect(headers).toMatch(
    /^\/_astro\/\*\n(?:\s+#.*\n|\s*\n)*\s+Cache-Control: public, max-age=31536000, immutable$/m,
  );
});

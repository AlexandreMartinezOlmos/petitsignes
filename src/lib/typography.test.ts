import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The accessibility statement tells visitors that every font size is relative
 * and follows the one they chose in their browser (WCAG 1.4.4). A single size
 * written in pixels would ignore that choice for whatever it styles, and nothing
 * on screen would look wrong to whoever wrote it.
 *
 * Read off disk, like `color.test.ts`: these are the bytes that ship, not a
 * build tool's view of them.
 */

function filesUnder(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => join(entry.parentPath, entry.name));
}

const sources = filesUnder('src', ['.css', '.astro', '.tsx']).map((file) => ({
  file,
  text: readFileSync(file, 'utf8'),
}));

const PIXEL_SIZES = [
  // CSS, in the stylesheet or a component's <style>.
  /font-size\s*:[^;{}]*\d+(?:\.\d+)?px/g,
  // Tailwind's arbitrary sizes, e.g. `text-[13px]`.
  /\btext-\[\d+(?:\.\d+)?px\]/g,
];

const pixelSizesIn = (text: string): string[] =>
  PIXEL_SIZES.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0]));

describe('font sizes', () => {
  it('reads the stylesheet and the components', () => {
    expect(sources.some(({ file }) => file.endsWith('global.css'))).toBe(true);
    expect(sources.filter(({ file }) => file.endsWith('.astro')).length).toBeGreaterThan(5);
  });

  it('are never written in pixels', () => {
    const offenders = sources.flatMap(({ file, text }) =>
      pixelSizesIn(text).map((found) => `${file}: ${found}`),
    );

    expect(offenders).toEqual([]);
  });

  // The check passes on an empty result, so an empty result has to mean
  // something: each form is found when present, and a relative size is not.
  it('catches the patterns it claims to', () => {
    expect(
      pixelSizesIn('.x { font-size: 13px; } <p class="text-[11.5px]"> .y { font-size: 1rem; }'),
    ).toEqual(['font-size: 13px', 'text-[11.5px]']);
  });
});

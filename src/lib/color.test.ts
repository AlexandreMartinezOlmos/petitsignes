import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import categories from '../content/categories.json' with { type: 'json' };
import { contrastRatio, deltaE, hueDistance, inGamut, maxChroma, type Oklch } from './color.ts';

/**
 * The palette, checked against the stylesheet that ships.
 *
 * These assertions exist because none of them can fail loudly on their own. An
 * out-of-gamut colour still renders — clipped, and clipped differently on a
 * wide-gamut screen, which is how fifteen "distinct" category hues arrived
 * looking identical. A tint pair below the just-noticeable difference still
 * renders. Both are invisible in review and obvious to a reader.
 */

// Read as a file rather than imported: the point is to check the stylesheet
// that ships, exactly as written, not a bundler's interpretation of it.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

const OKLCH = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.]+\s*)?\)/g;

/** Everything between a selector's opening brace and its matching close. */
function block(selector: string, from = 0): { body: string; start: number; end: number } {
  const at = CSS.indexOf(selector, from);
  if (at === -1) throw new Error(`selector not found in global.css: ${selector}`);
  const open = CSS.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === '{') depth += 1;
    else if (CSS[i] === '}') {
      depth -= 1;
      if (depth === 0) return { body: CSS.slice(open + 1, i), start: at, end: i };
    }
  }
  throw new Error(`unbalanced braces after ${selector}`);
}

const p3Block = block('@media (color-gamut: p3)');
const lightBlock = block(':root {', CSS.indexOf('--- Light theme'));
const darkMediaBlock = block(":root:not([data-theme='light'])");
const darkAttrBlock = block(":root[data-theme='dark']");

function number(body: string, token: string): number {
  const match = new RegExp(`${token}:\\s*([\\d.]+)\\s*;`).exec(body);
  if (!match) throw new Error(`token not found: ${token}`);
  return Number(match[1]);
}

function color(body: string, token: string): Oklch {
  const match = new RegExp(`${token}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`).exec(body);
  if (!match) throw new Error(`colour token not found: ${token}`);
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

/** The six family hues, read straight from the `--cat-hue` declarations. */
const HUES = [...CSS.matchAll(/--cat-hue:\s*([\d.]+)\s*;/g)].map((m) => Number(m[1]));

/** How a category tint is assembled at each depth, per theme. */
function catLayers(body: string, p3?: string) {
  const chroma = (token: string) =>
    p3 && new RegExp(`${token}:`).test(p3) ? number(p3, token) : number(body, token);
  return {
    bg: { l: number(body, '--cat-bg-l'), c: chroma('--cat-bg-c') },
    bg2: { l: number(body, '--cat-bg2-l'), c: chroma('--cat-bg2-c') },
    fg: { l: number(body, '--cat-fg-l'), c: chroma('--cat-fg-c') },
  };
}

describe('colour maths', () => {
  it('reproduces known sRGB values', () => {
    // #767676 on white is the canonical 4.5:1 boundary pair.
    expect(contrastRatio({ l: 0.5646, c: 0, h: 0 }, { l: 1, c: 0, h: 0 })).toBeCloseTo(4.57, 1);
    expect(contrastRatio({ l: 0, c: 0, h: 0 }, { l: 1, c: 0, h: 0 })).toBeCloseTo(21, 1);
  });

  it('knows sRGB is the smaller gamut', () => {
    const vivid = { l: 0.6, c: 0.2, h: 145 };
    expect(inGamut(vivid, 'srgb')).toBe(false);
    expect(inGamut(vivid, 'p3')).toBe(true);
    expect(maxChroma(0.6, 145, 'p3')).toBeGreaterThan(maxChroma(0.6, 145, 'srgb'));
  });
});

describe('every colour in the stylesheet is renderable', () => {
  it('names no colour outside sRGB, except inside the wide-gamut block', () => {
    const offenders: string[] = [];
    for (const match of CSS.matchAll(OKLCH)) {
      const at = match.index;
      // The uplift block is only ever applied by a display that reports P3.
      const gamut = at > p3Block.start && at < p3Block.end ? 'p3' : 'srgb';
      const [, l, c, h] = match;
      const value = { l: Number(l), c: Number(c), h: Number(h) };
      if (!inGamut(value, gamut)) {
        const line = CSS.slice(0, at).split('\n').length;
        offenders.push(
          `line ${line}: ${match[0]} exceeds ${gamut} ` +
            `(max chroma ${maxChroma(value.l, value.h, gamut).toFixed(3)})`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the wide-gamut uplift to the same lightness and hue', () => {
    // An uplift that shifted hue would make the site a different colour on a
    // better screen, which is the opposite of the point.
    for (const token of ['--brand-hover', '--brand-ink', '--focus']) {
      const base = color(lightBlock.body, token);
      const rich = color(block(':root {', p3Block.start).body, token);
      expect(rich.l, token).toBe(base.l);
      expect(rich.h, token).toBe(base.h);
      expect(rich.c, token).toBeGreaterThanOrEqual(base.c);
    }
  });
});

describe('category families', () => {
  it('gives every category a family', () => {
    const assigned = new Set([...CSS.matchAll(/\[data-category='([a-z-]+)'\]/g)].map((m) => m[1]));
    const missing = categories.map((c) => c.id).filter((id) => !assigned.has(id));
    expect(missing).toEqual([]);
  });

  it('separates the families far enough to be seen apart', () => {
    expect(HUES.length).toBe(6);
    for (let i = 0; i < HUES.length; i += 1) {
      for (let j = i + 1; j < HUES.length; j += 1) {
        expect(
          hueDistance(HUES[i]!, HUES[j]!),
          `hues ${HUES[i]} and ${HUES[j]}`,
        ).toBeGreaterThanOrEqual(45);
      }
    }
  });

  it.each([
    ['light', () => lightBlock.body, undefined],
    ['light on a P3 display', () => lightBlock.body, () => block(':root {', p3Block.start).body],
    ['dark', () => darkMediaBlock.body, undefined],
    [
      'dark on a P3 display',
      () => darkMediaBlock.body,
      () => block(":root:not([data-theme='light'])", p3Block.start).body,
    ],
  ])('keeps the category chip readable in %s', (_name, base, uplift) => {
    const layers = catLayers(base(), uplift?.());
    for (const h of HUES) {
      const ratio = contrastRatio({ ...layers.fg, h }, { ...layers.bg, h });
      // The chip is 12px text: WCAG 1.4.3 asks 4.5:1.
      expect(ratio, `hue ${h}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ['light', () => lightBlock.body],
    ['dark', () => darkMediaBlock.body],
  ])('makes any two family tints distinguishable in %s', (_name, base) => {
    const layers = catLayers(base());
    const tints = HUES.map((h) => ({ ...layers.bg, h }));
    for (let i = 0; i < tints.length; i += 1) {
      for (let j = i + 1; j < tints.length; j += 1) {
        // 0.02 in OKLab is roughly the just-noticeable difference over a large
        // flat area. The palette this replaced had pairs at 0.008.
        expect(deltaE(tints[i]!, tints[j]!), `hues ${HUES[i]} and ${HUES[j]}`).toBeGreaterThan(
          0.02,
        );
      }
    }
  });
});

/**
 * The card's call to action.
 *
 * It used to be white on a solid brand gradient, where the contrast was never
 * in question. It is now brand ink on the brand tint — quieter on purpose, and
 * the quieter a pairing gets the closer it drifts to the floor. This is bold
 * 16px text, which WCAG 1.4.3 would let past at 3:1 as large text; 4.5:1 is
 * the bar held here because the button appears 180 times and is the only route
 * to the thing the site exists for.
 */
describe('the card call to action', () => {
  it.each([
    ['light', () => lightBlock.body],
    ['dark', () => darkMediaBlock.body],
  ])('keeps its label readable in %s', (_name, base) => {
    const body = base();
    const ratio = contrastRatio(color(body, '--brand-ink'), color(body, '--brand-soft'));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the two dark declarations', () => {
  /**
   * `prefers-color-scheme` and an explicit `data-theme` cannot share a block,
   * so the dark values are written twice. Editing one and not the other gives
   * a site whose appearance depends on how the reader arrived at dark mode —
   * a real edit missed exactly this.
   */
  it('stay identical', () => {
    const normalise = (body: string) =>
      body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(';')
        .map((line) => line.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .sort();

    expect(normalise(darkAttrBlock.body)).toEqual(normalise(darkMediaBlock.body));
  });

  it('stay identical in the wide-gamut uplift too', () => {
    const media = block(":root:not([data-theme='light'])", p3Block.start).body;
    const attr = block(":root[data-theme='dark']", p3Block.start).body;
    const normalise = (body: string) =>
      body
        .split(';')
        .map((l) => l.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .sort();
    expect(normalise(attr)).toEqual(normalise(media));
  });
});

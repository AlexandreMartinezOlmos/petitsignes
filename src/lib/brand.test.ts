import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BRAND_MARK_PATHS,
  BRAND_MARK_SCALE,
  BRAND_MARK_STROKE,
  BRAND_MARK_TRANSFORM,
  brandMarkSvg,
} from './brand.ts';
import { BRAND_HEX } from '../pages/favicon.svg.ts';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf8');

/**
 * The logo is the one drawing on this site that appears in places no test opens:
 * a browser tab, a phone's home screen, a link preview in someone's chat. When
 * it drifts, nothing fails — it is simply wrong everywhere at once, and stays
 * wrong until a person notices.
 *
 * Whether it is *centred* is measured against a real renderer instead, in
 * `tests/e2e/brand.spec.ts`. Stroke width, round caps and a rotation all move
 * the ink, and none of them is in a path's nominal bounding box.
 */

describe('the mark is the brand’s own, not a borrowed icon', () => {
  const sprite = read('src/components/IconSprite.astro');

  /**
   * The whole point of the change that introduced this file. The logo used to
   * be `<use href="#i-wave">`, and `wave` is the **Cortesia** category's icon —
   * so the mark identifying the site was the same glyph as one of its fifteen
   * category chips.
   */
  it('shares no path with the icon sprite', () => {
    for (const d of BRAND_MARK_PATHS) {
      expect(sprite, `sprite must not contain a brand path`).not.toContain(d);
    }
  });

  it('left the wave icon untouched for the category that uses it', () => {
    expect(sprite).toMatch(/wave:\s*'M/);

    const categories = JSON.parse(read('src/content/categories.json')) as {
      id: string;
      icon: string;
    }[];
    expect(categories.find((c) => c.id === 'courtesy')?.icon).toBe('wave');
  });

  it('is not reached through the sprite from anywhere in the app', () => {
    for (const file of ['src/layouts/BaseLayout.astro', 'src/components/BrandMark.astro']) {
      const body = read(file).replace(/\/\*\*[\s\S]*?\*\//g, '');
      expect(body, file).not.toContain('#i-wave');
    }
  });
});

describe('every rendition is the same picture', () => {
  it('draws the mark from one set of paths, with one transform and one weight', () => {
    const svg = brandMarkSvg({ size: 180, background: '#000' });
    for (const d of BRAND_MARK_PATHS) expect(svg).toContain(d);
    expect(svg).toContain(BRAND_MARK_TRANSFORM);
    expect(svg).toContain(`stroke-width="${BRAND_MARK_STROKE}"`);
  });

  it('leaves the same breathing room around the mark at any size', () => {
    const round = (n: number): string => String(Number(n.toFixed(4)));
    for (const size of [16, 32, 180, 512]) {
      const svg = brandMarkSvg({ size });
      const inner = size * BRAND_MARK_SCALE;
      const offset = round((size - inner) / 2);
      expect(svg, `${size}px`).toContain(`translate(${offset} ${offset})`);
      expect(svg, `${size}px`).toContain(`scale(${round(inner / 24)})`);
    }
  });

  /** A shipped asset should not carry floating-point noise. */
  it('prints tidy numbers', () => {
    for (const size of [16, 32, 180, 512]) {
      expect(brandMarkSvg({ size, background: '#bc461e' }), `${size}px`).not.toMatch(/\d\.\d{6,}/);
    }
  });

  it('omits the tile when no background is asked for', () => {
    expect(brandMarkSvg({ size: 32 })).not.toContain('<rect');
    expect(brandMarkSvg({ size: 32, background: '#bc461e' })).toContain('<rect');
  });

  /**
   * `brand-assets.ts` renders the PNGs from this module. If it ever goes back to
   * reading a path out of the sprite, the home-screen icon and the tab can
   * disagree again without anything failing.
   */
  it('is what the PNG script draws', () => {
    const script = read('scripts/brand-assets.ts');
    expect(script).toContain("from '../src/lib/brand.ts'");
    expect(script).not.toContain('wavePath');
  });
});

/**
 * The favicon's hex is checked against `--brand` in `color.test.ts`, next to the
 * manifest's two copies of the same colour and the OKLCH maths that resolves
 * them. It belongs there rather than here: one place that knows how a token
 * becomes a hex literal, not two.
 */
describe('the favicon carries a colour at all', () => {
  it('paints its tile with the shared brand hex', () => {
    expect(BRAND_HEX).toMatch(/^#[0-9a-f]{6}$/);
    expect(brandMarkSvg({ size: 32, background: BRAND_HEX })).toContain(`fill="${BRAND_HEX}"`);
  });
});

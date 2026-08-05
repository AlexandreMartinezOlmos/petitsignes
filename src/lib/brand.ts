/**
 * The logo, and the only place it is drawn.
 *
 * It used to live in three: a hand-written copy in `public/favicon.svg`, a
 * `<use href="#i-wave">` in the header, and a regex in `scripts/brand-assets.ts`
 * that pulled the same `wave` path out of the icon sprite. Three copies of a
 * mark is three chances for the tab, the home screen and the shared link to
 * stop agreeing with each other.
 *
 * Worse than the duplication was what it was borrowing. `wave` is the icon of
 * the **Cortesia** category, so the site's logo was the same glyph as one of its
 * fifteen category chips: the mark in the header and the mark on a card in the
 * grid were indistinguishable. The brand now owns its drawing, and `wave` stays
 * exactly as it was for the category that needs it.
 *
 * It is a mark, not a gesture. An open hand is the project's logo and says
 * nothing about how any sign is performed — §2.1 forbids inventing one, and a
 * logo that read as a citation form would be doing precisely that.
 */

/**
 * Four fingers and a thumb, drawn as open strokes on a 24×24 grid.
 *
 * The finger lengths are deliberately unequal — middle tallest, then ring,
 * index, little. The previous mark had three fingers of matching height, which
 * is why it read as a flat signboard rather than a hand.
 */
export const BRAND_MARK_PATHS = [
  'M8 13.5V6.2a1.25 1.25 0 0 1 2.5 0V12',
  'M10.5 12V5.2a1.25 1.25 0 0 1 2.5 0V11.5',
  'M13 12V5.9a1.25 1.25 0 0 1 2.5 0V12.5',
  'M15.5 13V7.6a1.25 1.25 0 0 1 2.5 0V14',
  'M18 14a7 7 0 0 1-7 7 7 7 0 0 1-7-7v-2a1.5 1.5 0 0 1 3 0',
] as const;

export const BRAND_MARK_VIEWBOX = '0 0 24 24';

/**
 * Rotate, then centre. Both numbers are measured, not guessed.
 *
 * **The tilt** is what stops the mark reading as "stop". A raised open palm,
 * white on red, is the international sign for halt; the same hand at −16° reads
 * as a wave. Shallower and it straightens back into a signboard, steeper and it
 * looks like it is falling over.
 *
 * **The offset** was found by rasterising the mark at 30× and measuring the
 * extent of its actual ink — stroke, round caps and rotation included — rather
 * than the path's nominal bounding box, which ignores all three. The old mark
 * was 2 units left of centre in a 24 unit box, and that was visible. This one
 * lands within 0.01 of true centre: 3.92 of margin on the left against 3.93 on
 * the right, 2.63 above against 2.65 below. `brand.test.ts` re-measures it.
 */
export const BRAND_MARK_TRANSFORM = 'translate(0.6 -0.7) rotate(-16 12 12)';

/** Stroke weight in grid units. Below 1.7 the mark thins out at a 16px favicon. */
export const BRAND_MARK_STROKE = 1.8;

/**
 * How much of a square tile the mark occupies, leaving the rest as breathing
 * room. One number for every tile — favicon, home-screen icon, social card — so
 * that they are the same picture at different sizes rather than near misses.
 *
 * It was 0.58, inherited from a mark that nearly filled its own 24-unit grid.
 * This one does not: its ink is 16.2 wide by 18.7 tall, so 0.58 left the hand at
 * 45% of the tile's height, adrift in the middle of a lot of red and thin to the
 * point of vagueness at a 16px favicon. At 0.82 the ink is about 64% of the
 * height — full enough to read in a browser tab, with the corners still clear
 * for the rounding iOS applies on top of its own.
 */
export const BRAND_MARK_SCALE = 0.82;

/**
 * The mark as a standalone `<svg>`, for the places that cannot import an Astro
 * component: the generated `favicon.svg` and the brand PNG script.
 *
 * `background` draws the rounded tile behind it. Omitted, the mark comes out on
 * transparency, which is what a caller that supplies its own tile wants.
 */
export function brandMarkSvg(options: {
  size: number;
  color?: string;
  background?: string;
  radius?: number;
}): string {
  const { size, color = '#fff', background, radius = size * 0.25 } = options;

  // Rounded before they are printed. `32 * 0.58 / 24` is 0.7733333333333333 in
  // binary floating point, and a shipped asset should not carry sixteen
  // decimals of arithmetic noise for a number that means "roughly three
  // quarters". Four places is far finer than any renderer resolves.
  const round = (n: number): string => String(Number(n.toFixed(4)));

  const inner = size * BRAND_MARK_SCALE;
  const offset = (size - inner) / 2;

  const tile =
    background === undefined
      ? ''
      : `<rect width="${size}" height="${size}" rx="${round(radius)}" fill="${background}"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    tile,
    `<g transform="translate(${round(offset)} ${round(offset)}) scale(${round(inner / 24)})">`,
    `<g transform="${BRAND_MARK_TRANSFORM}" fill="none" stroke="${color}"`,
    ` stroke-width="${BRAND_MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round">`,
    BRAND_MARK_PATHS.map((d) => `<path d="${d}"/>`).join(''),
    '</g></g></svg>',
  ].join('');
}

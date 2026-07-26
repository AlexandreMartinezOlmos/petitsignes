/**
 * Colour maths for the palette test.
 *
 * The stylesheet authors every colour in OKLCH, which is what keeps the six
 * category families at one perceptual lightness. That convenience hides two
 * things a stylesheet cannot check on its own:
 *
 *  - OKLCH can name colours no screen can show. When it does, the browser
 *    clips per channel, silently, and clips *differently* on a wide-gamut
 *    display than on a plain one. Ten of the palette's colours used to do
 *    this, which is why hues that were 10 degrees apart on paper arrived
 *    identical on screen.
 *  - A contrast ratio is defined on sRGB luminance, not on OKLCH lightness.
 *    Equal lightness makes ratios *predictable*, not automatically passing.
 *
 * So the numbers live here and `color.test.ts` reads the real stylesheet and
 * checks them. None of this ships to the browser.
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Linear-light RGB, before the transfer function and before clamping. */
type Linear = readonly [number, number, number];

export type Gamut = 'srgb' | 'p3';

function toOklab({ l, c, h }: Oklch): readonly [number, number, number] {
  const rad = (h * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

/** OKLab's cone responses, shared by every output space below. */
function cones(l: number, a: number, b: number): Linear {
  return [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ];
}

function toLinearSrgb(color: Oklch): Linear {
  const [l, m, s] = cones(...toOklab(color));
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function toLinearP3(color: Oklch): Linear {
  const [l, m, s] = cones(...toOklab(color));
  const x = 1.2268798758 * l - 0.5578149944 * m + 0.2813910456 * s;
  const y = -0.0405757452 * l + 1.1122868032 * m - 0.0717110568 * s;
  const z = -0.0763729367 * l - 0.4214933324 * m + 1.5869240198 * s;
  return [
    2.4934969119 * x - 0.9313836179 * y - 0.4027107845 * z,
    -0.8294889696 * x + 1.7626640603 * y + 0.0236246858 * z,
    0.0358458302 * x - 0.0761723893 * y + 0.956884524 * z,
  ];
}

// A hair of tolerance: these are floating-point reconstructions of values the
// browser computes its own way, and an exact boundary test would flag colours
// that render perfectly.
const EPSILON = 1e-4;

/** Whether a screen in this gamut can render the colour without clipping it. */
export function inGamut(color: Oklch, gamut: Gamut = 'srgb'): boolean {
  const linear = gamut === 'srgb' ? toLinearSrgb(color) : toLinearP3(color);
  return linear.every((channel) => channel >= -EPSILON && channel <= 1 + EPSILON);
}

/** The most chroma this lightness and hue can hold before the gamut clips. */
export function maxChroma(l: number, h: number, gamut: Gamut = 'srgb'): number {
  let low = 0;
  let high = 0.5;
  // 40 halvings resolve chroma far past the third decimal the sheet uses.
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (inGamut({ l, c: mid, h }, gamut)) low = mid;
    else high = mid;
  }
  return low;
}

function relativeLuminance(color: Oklch): number {
  // Clamped, not rejected: this answers what the screen actually shows, which
  // for an out-of-gamut colour is the clipped version. `inGamut` is what says
  // whether clipping happened.
  const [r, g, b] = toLinearSrgb(color).map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.x contrast ratio, 1 to 21. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Euclidean distance in OKLab. Around 0.02 is the just-noticeable difference
 * for large flat areas like a card tint — below that, two categories are the
 * same colour as far as a reader is concerned.
 */
export function deltaE(a: Oklch, b: Oklch): number {
  const [al, aa, ab] = toOklab(a);
  const [bl, ba, bb] = toOklab(b);
  return Math.hypot(al - bl, aa - ba, ab - bb);
}

/** Smallest angle between two hues, in degrees. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

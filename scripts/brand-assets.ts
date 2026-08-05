/**
 * Renders the brand PNGs: the social card and the home-screen icons.
 *
 *   npm run brand:assets
 *
 * A content script, not a build step. §2.3 keeps the production build free of
 * system binaries, and rasterising on every build would put a browser in that
 * path — so this runs by hand and its output is committed, the same bargain the
 * vocabulary scripts make.
 *
 * Nothing here is drawn twice. The hand is imported from `src/lib/brand.ts` —
 * the same module the header and the generated `favicon.svg` render — and the
 * colours are read from the stylesheet's own tokens, so a brand change lands in
 * the PNGs by re-running this rather than by remembering to edit a second copy.
 * Chromium resolves the OKLCH itself, which means these files carry the same
 * colour the site does rather than a hex approximation of it.
 *
 * These are marks, not gestures: an open hand is the project's logo and says
 * nothing about how any sign is performed (§2.1).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  BRAND_MARK_PATHS,
  BRAND_MARK_SCALE,
  BRAND_MARK_STROKE,
  BRAND_MARK_TRANSFORM,
  BRAND_MARK_VIEWBOX,
} from '../src/lib/brand.ts';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');

/** Pull one value out of a source file, loudly, so a rename cannot pass silently. */
function extract(source: string, pattern: RegExp, what: string): string {
  const match = pattern.exec(source);
  if (!match?.[1]) throw new Error(`brand-assets: could not read ${what}`);
  return match[1];
}

async function readBrand() {
  const css = await readFile(path.join(ROOT, 'src/styles/global.css'), 'utf8');
  const light = css.slice(css.indexOf('--- Light theme'));

  return {
    brand: extract(light, /--brand:\s*(oklch\([^)]+\))/, '--brand'),
    brandInk: extract(light, /--brand-ink:\s*(oklch\([^)]+\))/, '--brand-ink'),
    surface: extract(light, /--surface:\s*(oklch\([^)]+\))/, '--surface'),
    ink: extract(light, /--ink:\s*(oklch\([^)]+\))/, '--ink'),
    inkMuted: extract(light, /--ink-muted:\s*(oklch\([^)]+\))/, '--ink-muted'),
  };
}

type Brand = Awaited<ReturnType<typeof readBrand>>;

/**
 * The hand, sized to a box. Takes no `stroke` argument any more: one weight for
 * every rendition is what makes the favicon, the home-screen icon and the social
 * card the same picture rather than three near misses.
 */
function mark(size: number): string {
  return `<svg viewBox="${BRAND_MARK_VIEWBOX}" width="${size}" height="${size}" fill="none"
    stroke="#fff" stroke-width="${BRAND_MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round">
    <g transform="${BRAND_MARK_TRANSFORM}">${BRAND_MARK_PATHS.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`;
}

/**
 * A full-bleed square. iOS applies its own rounding to `apple-touch-icon`, so
 * rounding it here would show a second, smaller corner inside Apple's.
 */
function iconHtml(b: Brand, size: number): string {
  return `<div style="width:${size}px;height:${size}px;background:${b.brand};
    display:flex;align-items:center;justify-content:center">
    ${mark(size * BRAND_MARK_SCALE)}</div>`;
}

/**
 * The social card. Kept to the wordmark, the tagline and a lot of quiet space:
 * a WhatsApp preview is read at thumbnail size, so anything more becomes noise.
 */
function ogHtml(b: Brand, title: string, tagline: string): string {
  const badge = 190;
  return `<div style="width:1200px;height:630px;background:${b.surface};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:38px;font-family:'Nunito Sans Variable',system-ui,sans-serif;text-align:center;
    padding:0 96px;box-sizing:border-box">
    <div style="width:${badge}px;height:${badge}px;border-radius:52px;background:${b.brand};
      display:flex;align-items:center;justify-content:center">
      ${mark(badge * BRAND_MARK_SCALE)}
    </div>
    <div style="font-size:82px;font-weight:800;color:${b.brandInk};letter-spacing:-0.02em">
      ${title}
    </div>
    <div style="font-size:37px;font-weight:600;color:${b.inkMuted};line-height:1.35;max-width:900px">
      ${tagline}
    </div>
    <div style="font-size:26px;font-weight:700;color:${b.ink};letter-spacing:0.14em">
      LSC &nbsp;·&nbsp; LSE
    </div>
  </div>`;
}

/**
 * The same variable font file the site preloads, inlined so the render does not
 * depend on the network or on whatever the machine happens to have installed.
 * Without it the card falls back to a system face and stops looking like the
 * site it advertises.
 */
async function fontFace(): Promise<string> {
  const file = path.join(
    ROOT,
    'node_modules/@fontsource-variable/nunito-sans/files/nunito-sans-latin-wght-normal.woff2',
  );
  const woff2 = await readFile(file);
  return `@font-face{font-family:'Nunito Sans Variable';font-style:normal;
    font-weight:200 1000;src:url(data:font/woff2;base64,${woff2.toString('base64')}) format('woff2')}`;
}

async function main(): Promise<void> {
  const brand = await readBrand();
  const font = await fontFace();

  // The card speaks to whoever is pasting the link, so it uses the default
  // locale's own words rather than a string invented for the image.
  const i18n = await readFile(path.join(ROOT, 'src/lib/i18n.ts'), 'utf8');
  const title = extract(i18n, /'site\.title':\s*'([^']+)'/, 'the site title');
  const tagline = extract(i18n, /'site\.tagline':\s*'([^']+)'/, 'the site tagline');

  await mkdir(PUBLIC_DIR, { recursive: true });
  const browser = await chromium.launch();

  const shots: { file: string; html: string; width: number; height: number }[] = [
    { file: 'og.png', html: ogHtml(brand, title, tagline), width: 1200, height: 630 },
    { file: 'apple-touch-icon.png', html: iconHtml(brand, 180), width: 180, height: 180 },
    { file: 'icon-192.png', html: iconHtml(brand, 192), width: 192, height: 192 },
    { file: 'icon-512.png', html: iconHtml(brand, 512), width: 512, height: 512 },
  ];

  try {
    for (const shot of shots) {
      const page = await browser.newPage({
        viewport: { width: shot.width, height: shot.height },
        // Rendered at 1× on purpose: these are consumed at fixed pixel sizes,
        // and a 2× file would be four times the bytes for no visible gain.
        deviceScaleFactor: 1,
      });
      await page.setContent(
        `<!doctype html><meta charset="utf-8">
         <style>${font}*{margin:0;padding:0}body{overflow:hidden}</style>${shot.html}`,
        { waitUntil: 'networkidle' },
      );
      const buffer = await page.screenshot({ type: 'png' });
      await writeFile(path.join(PUBLIC_DIR, shot.file), buffer);
      await page.close();
      console.log(`${shot.file} — ${shot.width}×${shot.height}, ${buffer.length} bytes`);
    }
  } finally {
    await browser.close();
  }
}

await main();

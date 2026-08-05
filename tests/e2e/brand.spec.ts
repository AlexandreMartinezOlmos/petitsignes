import { expect, test, type Page } from '@playwright/test';

/**
 * The logo, measured against a real renderer.
 *
 * `brand.test.ts` can check that every rendition is built from the same paths.
 * It cannot check whether the result looks centred, because none of what moves
 * the ink — a 1.8 stroke, round caps, a −16° rotation — appears in a path's
 * nominal bounding box. The mark this replaced was two units left of centre in
 * a 24 unit box and nothing caught it for months.
 *
 * So this rasterises what the browser actually paints and measures where the
 * white pixels land.
 */

/** Ink extents of the served favicon, in its own 32-unit coordinates. */
async function inkBounds(page: Page, url: string) {
  return page.evaluate(async (href) => {
    const SCALE = 20;
    const res = await fetch(href);
    const markup = await res.text();

    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(markup)));
    await img.decode();

    const size = 32 * SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);

    // The tile is the brand red and the mark is white: split on near-white so
    // the anti-aliased edge of the rounded rectangle is not counted as ink.
    const { data } = ctx.getImageData(0, 0, size, size);
    let minX = size;
    let maxX = -1;
    let minY = size;
    let maxY = -1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (data[i]! > 220 && data[i + 1]! > 200 && data[i + 2]! > 190) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const u = (v: number): number => v / SCALE;
    return { left: u(minX), right: 32 - u(maxX), top: u(minY), bottom: 32 - u(maxY) };
  }, url);
}

test.describe('the logo', () => {
  test('is centred in its tile, measured on the pixels the browser paints', async ({ page }) => {
    await page.goto('/');
    const m = await inkBounds(page, '/favicon.svg');

    // Tolerance is a fifth of a unit in a 32-unit box: tight enough that the
    // two-unit drift this replaced would fail by ten times over, loose enough
    // to survive the renderer's own anti-aliasing.
    expect(Math.abs(m.left - m.right), `left ${m.left} vs right ${m.right}`).toBeLessThan(0.2);
    expect(Math.abs(m.top - m.bottom), `top ${m.top} vs bottom ${m.bottom}`).toBeLessThan(0.2);
  });

  /**
   * Both ways of getting this wrong are silent. Too tight and the hand collides
   * with the rounding iOS puts on the home-screen icon; too loose and it floats
   * — which is what 0.58 did, leaving the mark at 45% of the tile and vague at a
   * 16px favicon.
   */
  test('leaves real breathing room rather than filling the tile', async ({ page }) => {
    await page.goto('/');
    const m = await inkBounds(page, '/favicon.svg');

    for (const [side, value] of Object.entries(m)) {
      expect(value, `${side} margin of 32`).toBeGreaterThan(3);
      expect(value, `${side} margin of 32`).toBeLessThan(8.5);
    }
  });

  test('is the same drawing in the header as in the tab', async ({ page }) => {
    await page.goto('/');

    const header = await page
      .locator('.brand-mark__dot svg path')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('d')));
    expect(header.length).toBe(5);

    const favicon = await page.evaluate(async () => (await fetch('/favicon.svg')).text());
    for (const d of header) expect(favicon).toContain(d!);
  });

  /**
   * §4.3-adjacent housekeeping: the header must not pull the logo out of the
   * icon sprite again, because `wave` belongs to the Cortesia category and the
   * two were indistinguishable while they shared it.
   */
  test('does not borrow the category sprite', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.brand-mark__dot use')).toHaveCount(0);
    // The sprite itself is still there, still serving the category chips.
    await expect(page.locator('#i-wave')).toHaveCount(1);
  });
});

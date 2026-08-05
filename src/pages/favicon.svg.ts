import type { APIRoute } from 'astro';
import { brandMarkSvg } from '../lib/brand.ts';

/**
 * Generated rather than kept in `public/`, because a static file was a second
 * hand-drawn copy of the logo. It had already drifted: its path was the sprite's
 * hand shifted by three units, so the tab and the home-screen icon were not
 * quite the same picture. Building it from `src/lib/brand.ts` means they cannot
 * disagree again.
 *
 * The brand colour is a literal here and an OKLCH token everywhere else. A
 * favicon is fetched by the browser outside any document, so it has no
 * stylesheet to read a custom property from, and `brand.test.ts` pins the two
 * to each other.
 */
export const BRAND_HEX = '#bc461e';

export const GET: APIRoute = () =>
  new Response(brandMarkSvg({ size: 32, background: BRAND_HEX, radius: 8 }), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });

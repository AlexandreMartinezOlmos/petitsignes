import type { APIRoute } from 'astro';
import { buildSitemap } from '../lib/seo.ts';

/**
 * Emitted at build time like every other page, so the deployed origin is the
 * one baked in. `Astro.site` already carries the `SITE_URL` override, which is
 * what lets a branch preview describe itself instead of production.
 */
export const GET: APIRoute = ({ site }) =>
  new Response(buildSitemap(site?.origin), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });

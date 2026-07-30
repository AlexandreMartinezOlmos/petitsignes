import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { categoryPaths } from '../lib/categories.ts';
import { SITE_PATHS, buildSitemap } from '../lib/seo.ts';
import { signPaths } from '../lib/signs.ts';

/**
 * Emitted at build time like every other page, so the deployed origin is the
 * one baked in. `Astro.site` already carries the `SITE_URL` override, which is
 * what lets a branch preview describe itself instead of production.
 *
 * The sign pages are read from the collection rather than listed: they are the
 * bulk of the sitemap, and a hand-written list would go stale the first time the
 * vocabulary changed — which it has, by fifty words in one sitting.
 *
 * Categories come before signs, which is the order a reader would meet them:
 * the catalogue, then the fifteen groupings, then the entries themselves.
 */
export const GET: APIRoute = async ({ site }) => {
  const signs = await getCollection('signs');
  const paths = [
    ...SITE_PATHS,
    ...categoryPaths(),
    ...signPaths(signs.map((entry) => entry.id).sort()),
  ];

  return new Response(buildSitemap(site?.origin, paths), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

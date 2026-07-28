import type { APIRoute } from 'astro';
import { buildRobots } from '../lib/seo.ts';

/**
 * Generated rather than dropped in `public/`, because the answer depends on
 * where this build is being served from: only the canonical domain invites
 * crawlers, and every branch preview refuses them. A static file could not
 * tell the difference.
 */
export const GET: APIRoute = ({ site }) =>
  new Response(buildRobots(site?.origin), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

import type { APIRoute } from 'astro';
import { manifestResponse } from '../../lib/manifest.ts';

/** The Spanish install: opens on the LSE catalogue, described in Spanish. */
export const GET: APIRoute = () => manifestResponse('es');

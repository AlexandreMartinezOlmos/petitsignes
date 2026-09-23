import type { APIRoute } from 'astro';
import { manifestResponse } from '../lib/manifest.ts';

/** Generated, one per locale, so its words come from the translations (see `manifest.ts`). */
export const GET: APIRoute = () => manifestResponse('ca');

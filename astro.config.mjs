// @ts-check
import { readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { SITE_ORIGIN, assertOrigin } from './src/lib/site.ts';

/**
 * Puts each locale's 404 where a static host will look for it.
 *
 * Cloudflare Pages answers an unmatched request with the closest `404.html`
 * walking up the directory tree, which is what lets `/es/…` fail in Spanish
 * instead of falling back to the Catalan page at the root. But `format:
 * 'directory'` writes a nested page to `es/404/index.html`, an address nothing
 * ever asks for — so the Spanish 404 would exist and never be served.
 *
 * Astro applies the format per build, not per page, and every other route wants
 * the directory form for its clean URL. Moving this one file afterwards is the
 * narrow fix; changing the format would rename the whole site.
 */
function localised404() {
  return {
    name: 'localised-404',
    hooks: {
      /** @type {(options: { dir: URL, logger: { info: (msg: string) => void } }) => Promise<void>} */
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        for (const item of await readdir(root, { withFileTypes: true })) {
          if (!item.isDirectory()) continue;
          const nested = path.join(root, item.name, '404', 'index.html');
          try {
            await rename(nested, path.join(root, item.name, '404.html'));
            await rm(path.join(root, item.name, '404'), { recursive: true, force: true });
            logger.info(`moved ${item.name}/404/index.html to ${item.name}/404.html`);
          } catch {
            // This locale has no 404 of its own; the root one covers it.
          }
        }
      },
    },
  };
}

// The canonical origin (canonical links, hreflang, Open Graph, sitemap). It is
// defined in src/lib/site.ts so that changing domain is a reviewed commit
// rather than a hosting-dashboard setting nobody can see.
//
// Branch previews have to describe themselves instead, or `robots.txt` cannot
// tell it is a preview and every deployment invites crawlers to content that
// duplicates production. `SITE_URL` overrides it by hand; failing that, this
// reads the two variables Cloudflare Pages sets on every build. The branch is
// what decides — `CF_PAGES_URL` is the pages.dev address even in production, so
// trusting it blindly would take the custom domain off the canonical links.
const previewOrigin =
  process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== 'main'
    ? process.env.CF_PAGES_URL
    : undefined;

const site = assertOrigin(process.env.SITE_URL ?? previewOrigin ?? SITE_ORIGIN);

export default defineConfig({
  site,
  // Fully static output: no server, no backend, no accounts. All progress is
  // kept in the visitor's own browser, so there is nothing to run server-side.
  output: 'static',
  // The interface language lives in the URL: `ca` at the root, `es` under
  // `/es/`. Each locale couples to a sign language (see src/lib/routing.ts).
  i18n: {
    locales: ['ca', 'es'],
    defaultLocale: 'ca',
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [react(), localised404()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // Emit `/about/index.html` so static hosts serve clean URLs without config.
    format: 'directory',
  },
});

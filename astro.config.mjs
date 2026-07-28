// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { SITE_ORIGIN, assertOrigin } from './src/lib/site.ts';

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
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // Emit `/about/index.html` so static hosts serve clean URLs without config.
    format: 'directory',
  },
});

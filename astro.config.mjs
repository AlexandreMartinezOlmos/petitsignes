// @ts-check
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { SITE_ORIGIN, assertOrigin } from './src/lib/site.ts';
import { buildCsp, collectInlineHashes, injectCsp } from './src/lib/csp.ts';
import { markPreviewHeaders } from './src/lib/seo.ts';

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

/**
 * Writes the Content Security Policy into `_headers`, hashed from the real output.
 *
 * It has to run after the build because the hashes are of files that do not
 * exist until then — Astro's hydration runtime, the critical CSS it inlines per
 * page, and this project's own two inline scripts. Hand-maintaining them would
 * mean a stale hash breaking the site on any unrelated change to markup.
 *
 * The policy is one header for the whole site rather than per page: `_headers`
 * matches by path, and a union of every page's hashes is both simpler to reason
 * about and smaller than repeating the shared runtime for 428 routes.
 *
 * The reasoning about *what* the policy allows lives in `src/lib/csp.ts`, which
 * is unit-tested. This hook is only the plumbing: walk, collect, write.
 */
function contentSecurityPolicy() {
  return {
    name: 'content-security-policy',
    hooks: {
      /** @type {(options: { dir: URL, logger: { info: (msg: string) => void } }) => Promise<void>} */
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);

        /** @type {(from: string) => Promise<string[]>} */
        const htmlFiles = async (from) => {
          /** @type {string[]} */
          const found = [];
          for (const item of await readdir(from, { withFileTypes: true })) {
            const full = path.join(from, item.name);
            if (item.isDirectory()) found.push(...(await htmlFiles(full)));
            else if (item.name.endsWith('.html')) found.push(full);
          }
          return found;
        };

        const scripts = new Set();
        const styles = new Set();
        const pages = await htmlFiles(root);
        for (const file of pages) {
          const found = collectInlineHashes(await readFile(file, 'utf8'));
          for (const hash of found.scripts) scripts.add(hash);
          for (const hash of found.styles) styles.add(hash);
        }

        const csp = buildCsp({ scripts: [...scripts], styles: [...styles] });
        const headersFile = path.join(root, '_headers');
        await writeFile(headersFile, injectCsp(await readFile(headersFile, 'utf8'), csp));

        logger.info(
          `CSP over ${pages.length} pages: ${scripts.size} script and ${styles.size} style hashes`,
        );
      },
    },
  };
}

/**
 * Marks a preview build's `_headers` with `noindex` for every path.
 *
 * `robots.txt` lets crawlers into a preview precisely so that they can read
 * this; the rule and its reasoning are in `markPreviewHeaders`. Runs after the
 * CSP hook, which rewrites the same file, and leaves production's untouched.
 *
 * @param {string} origin
 */
function previewNoindex(origin) {
  return {
    name: 'preview-noindex',
    hooks: {
      /** @type {(options: { dir: URL, logger: { info: (msg: string) => void } }) => Promise<void>} */
      'astro:build:done': async ({ dir, logger }) => {
        const headersFile = path.join(fileURLToPath(dir), '_headers');
        const before = await readFile(headersFile, 'utf8');
        const after = markPreviewHeaders(before, origin);
        if (after === before) return;

        await writeFile(headersFile, after);
        logger.info(`preview build for ${origin}: every response says noindex`);
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
  // The CSP hook goes last on purpose. Both it and `localised404` run on
  // `astro:build:done`, in array order, and hashing has to happen after
  // anything that could still change the HTML. Today `localised404` only
  // renames a file, so either order would hash the same bytes — this is
  // insurance against the next hook, which might not be so harmless.
  integrations: [
    react(),
    localised404(),
    contentSecurityPolicy(),
    previewNoindex(new URL(site).origin),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rolldownOptions: {
        output: {
          /**
           * Keep third-party licence banners in the bundle browsers download.
           *
           * The minifier strips comments, licence notices included, unless told
           * to keep the legal ones — and it only recognises `/*!`, `@license`
           * and `@preserve`. React marks its MIT notice `@license`, so this
           * keeps five of them: 1,171 bytes, 445 with gzip.
           *
           * Fuse.js ships a copyright banner in a plain `/**` block that does
           * not count as legal, and it is stripped either way; its attribution
           * lives in THIRD-PARTY-NOTICES.md with every dependency whose licence
           * sits in a separate file rather than a banner. That file is what
           * discharges the obligation for all of them — this keeps the notices
           * that can travel with the code travelling with it.
           *
           * It used to be `esbuild.legalComments`, with a comment claiming no
           * dependency used these markers. Vite 8 bundles and minifies with
           * Rolldown and oxc and ignores every `esbuild` option, so React's
           * notices were being stripped all along. `licence.spec.ts` now reads
           * the served JavaScript for them.
           */
          comments: { legal: true },
        },
      },
    },
  },
  build: {
    // Emit `/about/index.html` so static hosts serve clean URLs without config.
    format: 'directory',
  },
});

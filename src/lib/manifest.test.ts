import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslator } from './i18n.ts';
import { manifestPath, manifestResponse, webManifest } from './manifest.ts';
import { ROUTED_LOCALES } from './routing.ts';

/**
 * An installed app is the one part of the site nobody sees in a browser tab:
 * its name and description sit on a phone's home screen and in its settings,
 * and its start URL decides which sign language it opens on. With one Catalan
 * manifest, installing from `/es/` opened the LSC catalogue.
 */
describe('the web app manifest', () => {
  it('opens each locale’s install on its own catalogue', () => {
    expect(webManifest('ca').start_url).toBe('/');
    expect(webManifest('es').start_url).toBe('/es/');
  });

  it('describes the app in the language of the locale it was installed from', () => {
    for (const locale of ROUTED_LOCALES) {
      const manifest = webManifest(locale);
      expect(manifest.lang).toBe(locale);
      expect(manifest.description).toBe(createTranslator(locale)('site.tagline'));
    }
    expect(webManifest('es').description).not.toBe(webManifest('ca').description);
  });

  /**
   * Without an explicit `id` a browser derives one from `start_url`, which is
   * already distinct — but only by accident of where each one starts. Stated,
   * it survives someone pointing both at the same page.
   */
  it('gives each locale an identity of its own, so the two installs never merge', () => {
    const ids = ROUTED_LOCALES.map((locale) => webManifest(locale).id);
    expect(new Set(ids).size).toBe(ROUTED_LOCALES.length);
  });

  /** The language selector is a link: inside the app it has to stay inside the app. */
  it('keeps the whole site in scope, so switching language does not leave the app', () => {
    for (const locale of ROUTED_LOCALES) expect(webManifest(locale).scope).toBe('/');
  });

  it('only lists icons that exist', () => {
    for (const icon of webManifest('ca').icons) {
      expect(existsSync(resolve(process.cwd(), 'public', icon.src.slice(1))), icon.src).toBe(true);
    }
  });

  it('is served under each locale’s own prefix', () => {
    expect(manifestPath('ca')).toBe('/site.webmanifest');
    expect(manifestPath('es')).toBe('/es/site.webmanifest');
  });

  /**
   * The body is all the static build keeps, so it is what has to be right: a
   * browser that cannot parse it installs nothing and says nothing.
   */
  it('serves exactly the manifest, as JSON a browser can parse', async () => {
    for (const locale of ROUTED_LOCALES) {
      const body = await manifestResponse(locale).text();
      expect(JSON.parse(body)).toEqual(webManifest(locale));
    }
  });
});

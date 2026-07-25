/**
 * Project-wide constants that are neither content nor routing: where the source
 * lives and where to report problems. Kept in one place so a repository move is
 * a single edit, not a hunt across views.
 */
export const REPO_URL = 'https://github.com/AlexandreMartinezOlmos/petitsignes';
export const REPO_ISSUES_URL = `${REPO_URL}/issues`;

/**
 * The origin every canonical link, hreflang and sitemap entry is built from.
 *
 * It lives here, in the repository, and not only in a hosting dashboard: this
 * is the value that decides which domain search engines are told is the real
 * one. Pointing a new domain at the site without changing it would leave the
 * whole site declaring the previous domain as canonical — a failure with no
 * error message, visible only weeks later in the index. That is exactly what
 * happened when `petitsignes.cat` went live: the site served fine on the new
 * domain while still pointing search engines at `pages.dev`.
 *
 * Changing domain is therefore a reviewed commit. `SITE_URL` still overrides it
 * for preview deployments, which need their own origin and are not indexed.
 */
export const SITE_ORIGIN = 'https://petitsignes.cat';

/**
 * Where anonymous hit counts are sent, and the only host they are sent from.
 *
 * The same build is deployed to production and to every branch preview, so the
 * decision has to be made in the browser: counting from `develop.…pages.dev`
 * would mix my own testing into the real numbers. Localhost needs no guard —
 * GoatCounter's script ignores local addresses unless told otherwise.
 */
export const ANALYTICS_ENDPOINT = 'https://petitsignes.goatcounter.com/count';
export const ANALYTICS_SCRIPT = 'https://gc.zgo.at/count.js';

/**
 * The single host allowed to report analytics.
 *
 * Deliberately reads `SITE_ORIGIN` and **not** the `SITE_URL` override: a
 * preview built with its own origin must still refuse to count, or every
 * branch deployment would report as production. Analytics follows the
 * canonical domain, which only changes through a reviewed commit.
 */
export function analyticsHost(origin: string = SITE_ORIGIN): string {
  return new URL(origin).hostname;
}

/** Trailing slashes and paths break `new URL(path, origin)`; reject them early. */
export function assertOrigin(value: string): string {
  const url = new URL(value);
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(`SITE_URL must be a bare origin, got "${value}"`);
  }
  return url.origin;
}

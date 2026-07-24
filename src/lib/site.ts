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
 * whole site declaring `pages.dev` as canonical — a failure with no error
 * message, visible only weeks later in the index.
 *
 * Changing domain is therefore a reviewed commit. `SITE_URL` still overrides it
 * for preview deployments, which need their own origin and are not indexed.
 */
export const SITE_ORIGIN = 'https://petitsignes.pages.dev';

/** Trailing slashes and paths break `new URL(path, origin)`; reject them early. */
export function assertOrigin(value: string): string {
  const url = new URL(value);
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(`SITE_URL must be a bare origin, got "${value}"`);
  }
  return url.origin;
}

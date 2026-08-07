import { createHash } from 'node:crypto';

/**
 * The Content Security Policy, assembled from what the build actually emits.
 *
 * A CSP is the one header that fails *closed*: get it wrong and the browser
 * silently refuses to run something, which on this site means the video player
 * stops working for a visitor while every test still passes. So none of it is
 * written by hand. The hashes come from walking the built HTML, and the origins
 * below are the four the site really contacts — anything else is refused.
 *
 * Why hashes and not a nonce: a nonce has to be unique per response, and this
 * is a static site served from a CDN with no server to generate one. Hashes are
 * the static-hosting equivalent, and they have a property a nonce does not —
 * they pin the *content* of each inline script, so an injected `<script>` is
 * rejected even if an attacker can guess where it lands.
 */

/**
 * Every external origin the site is allowed to reach, and why.
 *
 * Kept as data rather than a template string so `csp.test.ts` can assert that
 * nothing was added without a reason, and so a reader can see the whole
 * third-party surface of the project in one place: it is four hosts.
 */
export const CSP_ORIGINS = {
  /** GoatCounter's counter script. */
  analyticsScript: 'https://gc.zgo.at',
  /** Where that script reports a hit. Anonymous and aggregate (CLAUDE.md §2.2). */
  analyticsEndpoint: 'https://petitsignes.goatcounter.com',
  /** The IFrame Player API, injected only when a visitor opens a video. */
  youtubeApi: 'https://www.youtube.com',
  /**
   * YouTube's asset host, allowed defensively rather than because it was seen.
   *
   * Measured on this build, the API pulled `www-widgetapi.js` from
   * `www.youtube.com` and never touched this host. But YouTube has served that
   * same file from `s.ytimg.com` historically and picks between them per
   * rollout and region, so a policy written from one browser on one afternoon
   * would break for someone else with no error anyone here would ever see.
   * Kept until a reason to drop it can be measured rather than assumed.
   */
  youtubeAssets: 'https://s.ytimg.com',
  /** The player's own document. `-nocookie` is deliberate (src/lib/youtube.ts). */
  youtubeFrame: 'https://www.youtube-nocookie.com',
} as const;

/** Base64 SHA-256 of one inline block, in the form CSP expects. */
export function sourceHash(body: string): string {
  return `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
}

/**
 * Inline `<script>` and `<style>` bodies in a document.
 *
 * The script pattern excludes anything carrying `src=`: those load an external
 * file and are covered by an origin, not a hash. Matching them anyway would add
 * a hash of the empty string — harmless, but it would misreport how many inline
 * scripts the site really has, which is the number worth watching.
 */
export function collectInlineHashes(html: string): { scripts: string[]; styles: string[] } {
  const scripts: string[] = [];
  const styles: string[] = [];

  for (const match of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    scripts.push(sourceHash(match[1] ?? ''));
  }
  for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    styles.push(sourceHash(match[1] ?? ''));
  }

  return { scripts, styles };
}

/**
 * The policy itself.
 *
 * `default-src 'none'` rather than `'self'`: it means every directive below is
 * an explicit grant, and any resource type nobody thought about — a plugin, a
 * web worker, a manifest fetched from elsewhere — is refused rather than
 * quietly inheriting permission.
 */
export function buildCsp(hashes: { scripts: string[]; styles: string[] }): string {
  const sorted = (values: string[]): string => [...new Set(values)].sort().join(' ');

  return [
    `default-src 'none'`,
    // The hashes cover Astro's hydration runtime and this project's two inline
    // scripts (analytics start-up and the catalogue's scroll restore). The two
    // origins are fetched by those scripts at runtime, not present in markup.
    `script-src 'self' ${sorted(hashes.scripts)} ${CSP_ORIGINS.analyticsScript} ${CSP_ORIGINS.youtubeApi} ${CSP_ORIGINS.youtubeAssets}`,
    // Hashed too, so there is no `'unsafe-inline'` anywhere in this policy.
    // Astro inlines a page's critical CSS, so these change whenever the design
    // does — which is exactly why they are computed per build and not pinned.
    `style-src 'self' ${sorted(hashes.styles)}`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    // GoatCounter reports a hit with a request from the page itself.
    `connect-src 'self' ${CSP_ORIGINS.analyticsEndpoint}`,
    // The only third party allowed to render inside this site.
    `frame-src ${CSP_ORIGINS.youtubeFrame}`,
    // And this site is not allowed to render inside anyone else's (§17.2).
    `frame-ancestors 'none'`,
    // Nothing here submits a form, so nowhere is a valid target for one.
    `form-action 'none'`,
    // Stops an injected <base> from re-pointing every relative URL on the page.
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

/**
 * The line in `public/_headers` this replaces.
 *
 * The static file ships a working `frame-ancestors 'none'` on its own, and this
 * swaps it for the full policy at build time. That ordering is deliberate: if
 * the build step ever stops running, the site still sends a valid — weaker —
 * header rather than a placeholder that means nothing, or no header at all.
 */
export const CSP_HEADER = 'Content-Security-Policy:';

export function injectCsp(headers: string, csp: string): string {
  const line = headers.split('\n').find((l) => l.trim().startsWith(CSP_HEADER));
  if (line === undefined) {
    throw new Error(
      `public/_headers has no "${CSP_HEADER}" line to replace. The build refuses to ` +
        `guess where the policy belongs: add the fallback line back rather than ` +
        `letting a build silently ship no policy at all.`,
    );
  }

  const indent = line.slice(0, line.length - line.trimStart().length);
  return headers.replace(line, `${indent}${CSP_HEADER} ${csp}`);
}

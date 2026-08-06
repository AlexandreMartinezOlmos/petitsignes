import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CSP_HEADER,
  CSP_ORIGINS,
  buildCsp,
  collectInlineHashes,
  injectCsp,
  sourceHash,
} from './csp.ts';

/**
 * A CSP is the one header on this site that fails *closed*. Every other header
 * here weakens or strengthens something the browser was going to do anyway; get
 * this one wrong and the browser refuses to run code, which on this site means
 * the video player dies for a visitor while every existing test still passes.
 *
 * So the policy is asserted from two directions. Here: that it is assembled
 * correctly and grants nothing it should not. In `tests/e2e/csp.spec.ts`: that a
 * real browser, sent this exact policy, still plays a sign.
 */

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('hashing what the page actually contains', () => {
  /** Pinned against a value computed independently, so a refactor of the hash
   * helper cannot quietly change every hash and still agree with itself. */
  it('produces the base64 SHA-256 CSP expects', () => {
    // echo -n "" | openssl dgst -sha256 -binary | openssl base64
    expect(sourceHash('')).toBe("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
  });

  it('hashes inline scripts and styles separately', () => {
    const found = collectInlineHashes('<script>a()</script><style>b{}</style>');
    expect(found.scripts).toEqual([sourceHash('a()')]);
    expect(found.styles).toEqual([sourceHash('b{}')]);
  });

  /**
   * A script with `src` is covered by an origin, not a hash. Matching it anyway
   * would add a hash of the empty string: harmless to the policy, but it would
   * overstate how many inline scripts the site has — the number worth watching,
   * because every one of them is a thing a nonce-less policy has to trust.
   */
  it('ignores scripts that load a file, whatever the attribute order', () => {
    expect(collectInlineHashes('<script src="/a.js"></script>').scripts).toEqual([]);
    expect(collectInlineHashes('<script type="module" src="/a.js"></script>').scripts).toEqual([]);
    expect(collectInlineHashes('<script defer src="/a.js"></script>').scripts).toEqual([]);
  });

  it('still hashes an inline script that merely carries attributes', () => {
    expect(collectInlineHashes('<script type="module">go()</script>').scripts).toEqual([
      sourceHash('go()'),
    ]);
  });

  it('finds every occurrence in a page, not just the first', () => {
    const found = collectInlineHashes('<script>a()</script><p>x</p><script>b()</script>');
    expect(found.scripts).toHaveLength(2);
  });
});

describe('the policy grants only what this site needs', () => {
  const csp = buildCsp({ scripts: [sourceHash('a()')], styles: [sourceHash('b{}')] });

  /**
   * The whole reason for hashing. `'unsafe-inline'` would let *any* injected
   * script run and reduce the policy to decoration; `'unsafe-eval'` would hand
   * back `eval`. If a future change makes the build need either, that is a
   * decision to argue about in a review — which means deleting this test — not
   * a word that gets copied in from an example.
   */
  it('never falls back to unsafe-inline or unsafe-eval', () => {
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('starts from default-src none, so every grant below is deliberate', () => {
    expect(csp).toContain("default-src 'none'");
  });

  it('carries the hashes it was given', () => {
    expect(csp).toContain(sourceHash('a()'));
    expect(csp).toContain(sourceHash('b{}'));
  });

  it('de-duplicates a hash shared by many pages', () => {
    const repeated = buildCsp({ scripts: [sourceHash('a()'), sourceHash('a()')], styles: [] });
    expect(repeated.match(/sha256-/g)).toHaveLength(1);
  });

  /**
   * §4.3 and §2.2: the player is opt-in and the analytics are anonymous. The
   * policy is where those promises stop depending on the code being careful —
   * a fifth origin cannot be contacted even if some future dependency tries.
   */
  it('reaches exactly the four third parties the project documents', () => {
    const origins = [...csp.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]);
    expect(new Set(origins)).toEqual(new Set(Object.values(CSP_ORIGINS)));
  });

  it('lets YouTube frame in, and nobody frame us', () => {
    expect(csp).toContain(`frame-src ${CSP_ORIGINS.youtubeFrame}`);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  /** Nothing on this site submits a form, and an injected `<base>` would
   * silently re-point every relative URL on the page. */
  it('closes the openings a static site has no use for', () => {
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  it('is a single line, because a header cannot be anything else', () => {
    expect(csp).not.toContain('\n');
  });
});

describe('writing the policy into _headers', () => {
  it('replaces the fallback line and keeps its indentation', () => {
    const result = injectCsp(`/*\n  ${CSP_HEADER} frame-ancestors 'none'\n`, 'default-src none');
    expect(result).toContain(`  ${CSP_HEADER} default-src none`);
    expect(result).not.toContain("frame-ancestors 'none'");
  });

  /**
   * Refusing beats guessing. A build that quietly appended the policy somewhere
   * plausible could ship it under the wrong path pattern, and the site would
   * serve no policy at all while the build log looked perfectly healthy.
   */
  it('refuses to guess when the line is gone', () => {
    expect(() => injectCsp('/*\n  X-Frame-Options: DENY\n', 'x')).toThrow(/no "Content-Security/);
  });

  /**
   * The two files have to agree or the build throws. `public/_headers` ships a
   * working `frame-ancestors` on its own so that a build which somehow skipped
   * the hook still sends a valid, weaker header rather than nothing.
   */
  it('has a line to replace in the real public/_headers', () => {
    const headers = read('public/_headers');
    expect(headers).toContain(CSP_HEADER);
    expect(() => injectCsp(headers, buildCsp({ scripts: [], styles: [] }))).not.toThrow();
  });
});

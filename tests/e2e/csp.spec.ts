import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * The site, under its own Content Security Policy, in a real browser.
 *
 * `csp.test.ts` can prove the policy is assembled correctly. It cannot prove
 * the policy is *survivable* — that is a question about what Chromium does when
 * it meets these directives, and the failure mode is the worst kind this repo
 * has: a visitor clicks a sign, nothing happens, and no test anywhere goes red.
 *
 * The header is injected here rather than served, because `astro preview` does
 * not read `_headers` — that is Cloudflare's job in production. So this reads
 * the policy the build actually wrote and makes the browser obey it, which is
 * as close to production as this suite can get without deploying.
 */

const CSP = (() => {
  const headers = readFileSync(resolve(process.cwd(), 'dist/_headers'), 'utf8');
  const line = headers.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
  if (line === undefined) throw new Error('dist/_headers carries no CSP — did the build run?');
  return line.replace('Content-Security-Policy:', '').trim();
})();

/**
 * Serve every document with the real policy, and record what the browser
 * refuses. `securitypolicyviolation` is used rather than console scraping: it
 * is the browser's own structured report, and it names the directive that
 * blocked — which is the one piece of information needed to fix a failure.
 */
async function underPolicy(page: Page): Promise<{ violations: () => Promise<string[]> }> {
  // Only this site's own documents. A blanket `**/*` also intercepts the
  // player's requests to YouTube, and those are still in flight when the test
  // ends — which Playwright reports as a route error that has nothing to do
  // with the policy being tested. A browser applies the CSP of the document it
  // came from, so these are the only responses that need touching.
  await page.route(
    (url) => url.hostname === 'localhost',
    async (route) => {
      const response = await route.fetch();
      const type = response.headers()['content-type'] ?? '';
      if (!type.includes('text/html')) return route.fulfill({ response });
      return route.fulfill({
        response,
        headers: { ...response.headers(), 'content-security-policy': CSP },
      });
    },
  );

  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __csp: string[] }).__csp.push(
        `${event.violatedDirective} blocked ${event.blockedURI}`,
      );
    });
  });

  return {
    violations: () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp),
  };
}

test.describe('the site under its own CSP', () => {
  for (const path of ['/', '/es/', '/signe/leche/', '/el-projecte/']) {
    test(`${path} loads and hydrates with nothing blocked`, async ({ page }) => {
      const policy = await underPolicy(page);
      await page.goto(path);

      // Reach the bottom before asserting. `/el-projecte/` mounts its progress
      // panel with `client:visible`, so at rest that island is *supposed* to be
      // dormant — asserting on load would fail for the one reason that is not a
      // CSP problem, and scrolling exercises more of the page besides.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Hydration is the sharp end: React arrives through Astro's inline
      // runtime, so a missing script hash shows up here as islands that never
      // wake rather than as an error anyone would notice.
      await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
      expect(await policy.violations(), `blocked on ${path}`).toEqual([]);
    });
  }

  /**
   * §4.3's opt-in player is the reason `frame-src` and the YouTube origins are
   * in the policy at all. If the hashes are right but an origin is missing, the
   * catalogue looks perfect and only this fails.
   */
  test('a sign still plays, which is what the YouTube origins are for', async ({ page }) => {
    const policy = await underPolicy(page);
    await page.goto('/');

    await page.locator('.sign-card__cta').first().click();

    const frame = page.locator('dialog[open] iframe');
    await expect(frame).toHaveAttribute('src', /youtube-nocookie\.com/);
    // The API only defines `YT` once its script has run — proof the origin was
    // allowed, not merely that an empty frame was inserted.
    await expect.poll(() => page.evaluate(() => typeof window.YT)).toBe('object');

    expect(await policy.violations(), 'blocked while opening a video').toEqual([]);
  });

  /**
   * The policy is only as good as its narrowest directive. This is the
   * assertion that would fail the day someone "fixes" a build problem by
   * loosening the policy instead of by adding the hash it was missing.
   */
  test('the shipped policy is strict, not merely present', async () => {
    expect(CSP).not.toContain('unsafe-inline');
    expect(CSP).not.toContain('unsafe-eval');
    expect(CSP).toContain("default-src 'none'");
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(CSP.match(/sha256-/g)?.length ?? 0).toBeGreaterThan(0);
  });
});

import { expect, test } from '@playwright/test';
import { CSP_ORIGINS } from '../../src/lib/csp.ts';

/**
 * The privacy section names every party a visit can reach.
 *
 * `CSP_ORIGINS` is the complete list of third-party hosts a browser is allowed
 * to contact from this site — the policy refuses anything else. So it is also
 * the list the privacy text owes the visitor. It once named GoatCounter and
 * said nothing about YouTube, which a visitor reaches the moment they open an
 * LSC video: true sentence by sentence, misleading as a whole.
 *
 * A host missing from `PROVIDERS` fails the run, which is the point: adding a
 * third party to the policy means deciding how the privacy text names it.
 */
const PROVIDERS: Record<string, string> = {
  'gc.zgo.at': 'GoatCounter',
  'petitsignes.goatcounter.com': 'GoatCounter',
  'www.youtube.com': 'YouTube',
  's.ytimg.com': 'YouTube',
  'www.youtube-nocookie.com': 'YouTube',
};

/**
 * Not in the CSP, because they are not contacted *from* a page: the host that
 * serves every request, and the dictionary an LSE sign links out to.
 */
const ALSO_NAMED = ['Cloudflare', 'DILSE'];

for (const path of ['/el-projecte/', '/es/el-projecte/']) {
  test(`${path} names every third party a visit can reach`, async ({ page }) => {
    await page.goto(path);
    const section = page.locator('section[aria-labelledby="privacy"]');
    const text = await section.innerText();

    for (const origin of Object.values(CSP_ORIGINS)) {
      const host = new URL(origin).hostname;
      const provider = PROVIDERS[host];
      expect(provider, `${host} is in the CSP but has no name in the privacy text`).toBeDefined();
      expect(text, `the privacy section does not mention ${provider}`).toContain(provider);
    }
    for (const name of ALSO_NAMED) {
      expect(text, `the privacy section does not mention ${name}`).toContain(name);
    }

    // The complete list of counted events is one link away, not a promise to
    // take on trust.
    await expect(section.getByRole('link')).toHaveAttribute('href', /#privacidad-/);
  });
}

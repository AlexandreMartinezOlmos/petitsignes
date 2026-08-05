import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `public/_headers` has no module to import and no screen to look at: it is a
 * plain file that Cloudflare Pages either finds at the root of the build or
 * silently ignores. Renaming it, moving it out of `public/`, or mistyping a
 * directive all fail the same way — the site keeps working and quietly stops
 * making the promise. This is the only place that would notice.
 */

const HEADERS = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');

/**
 * Comments stripped before anything is asserted. The first version of this file
 * matched against the raw text, and the `preload` case below failed on the
 * comment explaining why `preload` is absent — a test reading the prose as
 * though it were the policy.
 */
const DIRECTIVES = HEADERS.split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('/'));

const HSTS = DIRECTIVES.find((line) => line.startsWith('Strict-Transport-Security:'));

describe('public/_headers', () => {
  it('applies its rules to every path', () => {
    expect(HEADERS).toMatch(/^\/\*$/m);
  });

  it('sends HSTS for at least a year, covering www', () => {
    expect(HSTS).toBeDefined();

    const maxAge = Number(HSTS?.match(/max-age=(\d+)/)?.[1]);
    // A year is the floor the HSTS preload list asks for, and the point below
    // which the header stops being worth sending: a short max-age expires
    // between visits, which is exactly when it would have been needed.
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
    expect(HSTS).toContain('includeSubDomains');
  });

  /**
   * Deliberate, and the reason it is asserted rather than left to judgement:
   * `preload` is close to irreversible once browsers ship it, so it should
   * arrive as a decision someone makes on purpose — which means deleting this
   * test — rather than as a word that got copied in from an example.
   */
  it('does not opt into the preload list', () => {
    expect(HSTS).not.toContain('preload');
  });

  it('reserves text and data mining rights', () => {
    expect(DIRECTIVES).toContain('tdm-reservation: 1');
  });
});

/**
 * The protocol lets an agent read either the header or the well-known file, and
 * never says which wins. Two sources that disagree would therefore be worse
 * than one: whichever an agent happened to read would be the answer, and the
 * other would be a reservation that quietly does not apply.
 */
describe('the mining reservation agrees with itself', () => {
  const tdmrep = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/.well-known/tdmrep.json'), 'utf8'),
  ) as { location: string; 'tdm-reservation': number; 'tdm-policy'?: string }[];

  it('covers the whole origin', () => {
    expect(tdmrep.some((entry) => entry.location === '/')).toBe(true);
  });

  it('reserves in the file exactly as it does in the header', () => {
    const headerReserves = DIRECTIVES.includes('tdm-reservation: 1');
    for (const entry of tdmrep) {
      expect(entry['tdm-reservation'], entry.location).toBe(headerReserves ? 1 : 0);
    }
  });

  it('names the same policy in both', () => {
    const fromHeader = DIRECTIVES.find((line) => line.startsWith('tdm-policy:'))
      ?.replace('tdm-policy:', '')
      .trim();

    for (const entry of tdmrep) {
      if (entry['tdm-policy'] !== undefined) expect(entry['tdm-policy']).toBe(fromHeader);
    }
  });
});

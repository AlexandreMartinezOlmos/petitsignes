import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTACT_EMAIL,
  REPO_ISSUES_URL,
  REPO_SECURITY_ADVISORY_URL,
  REPO_LICENSE_URL,
  REPO_NOTICE_URL,
  REPO_THIRD_PARTY_URL,
  REPO_URL,
  SITE_ORIGIN,
  assertOrigin,
  mailtoUrl,
  newIssueUrl,
} from './site.ts';

const read = (name: string) => readFileSync(resolve(process.cwd(), name), 'utf8');

describe('SITE_ORIGIN', () => {
  // Every canonical link, hreflang and Open Graph URL is built from this. A
  // trailing slash or a path here would corrupt all of them at once.
  it('is a bare https origin', () => {
    expect(SITE_ORIGIN).toBe(new URL(SITE_ORIGIN).origin);
    expect(SITE_ORIGIN.startsWith('https://')).toBe(true);
    expect(SITE_ORIGIN.endsWith('/')).toBe(false);
  });
});

describe('assertOrigin', () => {
  it('accepts a bare origin and normalises it', () => {
    expect(assertOrigin('https://petitsignes.cat')).toBe('https://petitsignes.cat');
    expect(assertOrigin('https://petitsignes.cat/')).toBe('https://petitsignes.cat');
  });

  // A SITE_URL with a path silently produces canonicals like
  // `https://host/ca/ca/`, which is worse than failing the build.
  it('rejects anything that is not just an origin', () => {
    expect(() => assertOrigin('https://petitsignes.cat/ca/')).toThrow(/bare origin/);
    expect(() => assertOrigin('https://petitsignes.cat/?x=1')).toThrow(/bare origin/);
    expect(() => assertOrigin('https://petitsignes.cat/#top')).toThrow(/bare origin/);
  });

  it('rejects a value that is not a URL at all', () => {
    expect(() => assertOrigin('petitsignes.cat')).toThrow();
    expect(() => assertOrigin('')).toThrow();
  });
});

describe('repository links', () => {
  it('points issues at the repository', () => {
    expect(REPO_ISSUES_URL.startsWith(REPO_URL)).toBe(true);
    expect(REPO_URL.endsWith('.git')).toBe(false);
  });

  it('points at the licence documents that exist in the repository', () => {
    expect(REPO_LICENSE_URL).toBe(`${REPO_URL}/blob/HEAD/LICENSE`);
    expect(REPO_NOTICE_URL).toBe(`${REPO_URL}/blob/HEAD/NOTICE`);
    expect(REPO_THIRD_PARTY_URL).toBe(`${REPO_URL}/blob/HEAD/THIRD-PARTY-NOTICES.md`);
  });

  /**
   * `HEAD`, not `main`. GitHub resolves `blob/HEAD` to whatever the default
   * branch is called, so renaming it does not turn the licence link — the one
   * link on the site carrying a legal obligation — into a 404 that nobody
   * notices, because nobody clicks a licence link until they need it.
   */
  it('survives the default branch being renamed', () => {
    for (const url of [REPO_LICENSE_URL, REPO_NOTICE_URL, REPO_THIRD_PARTY_URL]) {
      expect(url).toContain('/blob/HEAD/');
      expect(url).not.toContain('/blob/main/');
    }
  });
});

describe('newIssueUrl', () => {
  it('opens the new-issue form on the repository', () => {
    const url = new URL(newIssueUrl('t', 'b'));
    expect(url.origin).toBe('https://github.com');
    expect(url.pathname).toBe('/AlexandreMartinezOlmos/petitsignes/issues/new');
  });

  /**
   * The reason this is a function and not a template string in the view.
   *
   * A report is written in Catalan or Spanish and arrives as several lines, so
   * the parts that break a hand-rolled query string — accents, the `#` and `&`
   * that markdown and URLs both want, line breaks — are the normal case rather
   * than the edge one. Truncating someone's report at the first `&` would lose
   * exactly the sentence explaining what is wrong.
   */
  it('carries accents, newlines and URL punctuation through intact', () => {
    const title = 'Signe «llet» (LSC) & més';
    const body =
      'Línia u\n\n- **Signe:** `leche`\n- **Pàgina:** https://petitsignes.cat/signe/leche/?a=1#b';

    const url = new URL(newIssueUrl(title, body));

    expect(url.searchParams.get('title')).toBe(title);
    expect(url.searchParams.get('body')).toBe(body);
  });

  it('produces a link with nothing left to interpolate', () => {
    const url = newIssueUrl('Signe «llet»', 'Pàgina: /signe/leche/');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('{');
  });
});

describe('mailtoUrl', () => {
  it('writes to the project address, with the subject already filled in', () => {
    const url = mailtoUrl('Signe «llet» (LSC)');

    expect(url.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(url.split('subject=')[1]!)).toBe('Signe «llet» (LSC)');
  });

  // Mail apps read a `+` in a mailto literally; RFC 6068 asks for `%20`.
  it('encodes spaces so the subject arrives as written', () => {
    expect(mailtoUrl('Signo «leche» (LSE)')).not.toContain('+');
    expect(mailtoUrl('Signo «leche» (LSE)')).toContain('%20');
  });
});

/**
 * Every way to write to the project, in every place that offers one.
 *
 * The address used to live next to one page's copy while four other files
 * spelled it out by hand, and the code of conduct offered a "private issue",
 * which GitHub does not have. A security problem and a conduct report must
 * never be steered to a public tracker, and every channel must name the
 * address that is actually read.
 */
describe('the contact channels', () => {
  const SECURITY_TXT = read('public/.well-known/security.txt');

  it('all name the same address', () => {
    for (const file of [
      'README.md',
      'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md',
      'SECURITY.md',
      'public/.well-known/security.txt',
    ]) {
      expect(read(file), file).toContain(CONTACT_EMAIL);
    }
  });

  it('send a security report somewhere private, never to the public issues', () => {
    const contacts = [...SECURITY_TXT.matchAll(/^Contact: (.+)$/gm)].map((match) => match[1]);

    expect(contacts).toEqual([REPO_SECURITY_ADVISORY_URL, `mailto:${CONTACT_EMAIL}`]);
    expect(read('SECURITY.md')).toContain(REPO_SECURITY_ADVISORY_URL);
    expect(SECURITY_TXT).not.toContain(REPO_ISSUES_URL);
  });

  it('publish a policy that exists in the repository', () => {
    const policy = SECURITY_TXT.match(/^Policy: (.+)$/m)?.[1];

    expect(policy).toBe(`${REPO_URL}/blob/HEAD/SECURITY.md`);
    expect(existsSync(resolve(process.cwd(), 'SECURITY.md'))).toBe(true);
  });

  it('take conduct reports by email, not in a public issue', () => {
    const conduct = read('CODE_OF_CONDUCT.md');

    expect(conduct).toContain(`mailto:${CONTACT_EMAIL}`);
    expect(conduct).not.toMatch(/incidencia privada/i);
  });
});

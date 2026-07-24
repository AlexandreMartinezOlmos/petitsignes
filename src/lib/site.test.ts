import { describe, expect, it } from 'vitest';
import { REPO_ISSUES_URL, REPO_URL, SITE_ORIGIN, assertOrigin } from './site.ts';

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
});

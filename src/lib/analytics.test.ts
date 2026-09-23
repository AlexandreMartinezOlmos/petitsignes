import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_EVENTS, countEvent } from './analytics.ts';
import { ANALYTICS_ENDPOINT, SITE_ORIGIN, analyticsHost } from './site.ts';

afterEach(() => {
  delete window.goatcounter;
});

describe('countEvent', () => {
  it('reports the event name as an event, never as a page view', () => {
    const count = vi.fn();
    window.goatcounter = { count };

    countEvent(ANALYTICS_EVENTS.playLsc);

    expect(count).toHaveBeenCalledWith({ path: 'video-lsc', event: true });
  });

  // The script is absent in development, on preview deployments and whenever a
  // visitor blocks it. None of that may break an interaction.
  it('does nothing when the script is not loaded', () => {
    expect(() => {
      countEvent(ANALYTICS_EVENTS.addFavorite);
    }).not.toThrow();
  });

  it('swallows a failure inside the analytics script', () => {
    window.goatcounter = {
      count: () => {
        throw new Error('blocked');
      },
    };

    expect(() => {
      countEvent(ANALYTICS_EVENTS.progressReset);
    }).not.toThrow();
  });
});

describe('the set of events', () => {
  /**
   * The privacy promise made on the project page is that nothing a visitor
   * types or chooses is ever sent. `countEvent` only accepts `AnalyticsEvent`,
   * so this is enforced by the type system; this test pins the values so a
   * later edit cannot quietly widen them into something identifying.
   */
  it('is a closed set of fixed, non-identifying names', () => {
    const names = Object.values(ANALYTICS_EVENTS);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name, `"${name}" must be a fixed slug`).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('never counts the removal of a favourite or a learned sign', () => {
    // Counting both directions would start to resemble a per-visitor history
    // rather than an aggregate measure of use.
    const names: string[] = Object.values(ANALYTICS_EVENTS);
    expect(names).not.toContain('preferit-eliminat');
    expect(names).not.toContain('apres-desmarcat');
  });
});

describe('analyticsHost', () => {
  // Production and every branch preview are served from the same build, so the
  // host check is the only thing keeping preview traffic out of the real
  // numbers.
  it('is the host of the canonical origin', () => {
    expect(analyticsHost()).toBe(new URL(SITE_ORIGIN).hostname);
    expect(analyticsHost()).not.toContain('/');
  });

  it('does not match a branch preview of the same project', () => {
    expect(analyticsHost('https://petitsignes.pages.dev')).not.toBe(
      'develop.petitsignes.pages.dev',
    );
  });

  /**
   * A preview deployment is built with SITE_URL pointing at its own origin. The
   * gate must keep reading the canonical constant, or every branch deployment
   * would start reporting itself as production.
   */
  it('ignores the SITE_URL override that previews are built with', () => {
    expect(analyticsHost()).toBe(new URL(SITE_ORIGIN).hostname);
    expect(analyticsHost()).not.toBe('develop.petitsignes.pages.dev');
  });

  it('sends to the project endpoint over https', () => {
    expect(ANALYTICS_ENDPOINT).toMatch(/^https:\/\/[a-z-]+\.goatcounter\.com\/count$/);
  });
});

/**
 * The site serves its own copy of GoatCounter's `count.js`
 * (`src/vendor/goatcounter/`) instead of loading it from their CDN, so what a
 * visitor runs is what was reviewed here. These tests are what keep "reviewed"
 * true when someone updates it.
 */
describe('the counter the site serves', () => {
  const counter = readFileSync(resolve(process.cwd(), 'src/vendor/goatcounter/count.js'));

  /**
   * GoatCounter's file exactly as published: `https://gc.zgo.at/count.js`,
   * identical to `public/count.js` at arp242/goatcounter@478f026. Updating it
   * means downloading it again, reading the diff, and changing this hash in
   * the same commit — never editing the file by hand.
   */
  it('is the copy that was reviewed, unmodified', () => {
    const digest = createHash('sha384').update(counter).digest('base64');
    expect(digest).toBe('2UjvVpptg4JlEVgJI2PdscrjOjPcil/4F1ZvIMJ81CShQnEDSlPI+l4PfogvTLYi');
  });

  /**
   * The project page says a counted visit carries the width of the screen.
   * GoatCounter's versioned files (v4, v5) send its height and pixel density
   * as well, which is why this copy was chosen over pinning one of them with
   * SRI; an update that brought those back would make that sentence false.
   */
  it('sends the width of the screen and nothing else about it', () => {
    const source = counter.toString('utf8');
    expect(source).toMatch(/\bs:\s*window\.screen\.width,/);
    expect(source).not.toMatch(/screen\.height|devicePixelRatio/);
  });
});

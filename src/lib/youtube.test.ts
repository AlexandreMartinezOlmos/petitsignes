import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YOUTUBE_API_TIMEOUT_MS, youtubeId } from './youtube.ts';

describe('youtubeId', () => {
  it('reads the id from a short youtu.be link', () => {
    expect(youtubeId('https://youtu.be/j7EYGZt-CJc')).toBe('j7EYGZt-CJc');
  });

  it('reads the id from a watch URL', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=j7EYGZt-CJc')).toBe('j7EYGZt-CJc');
  });

  it('keeps ids that contain dashes and underscores', () => {
    expect(youtubeId('https://youtu.be/18xWl17R__E')).toBe('18xWl17R__E');
  });

  it('reads the id from the nocookie host', () => {
    expect(youtubeId('https://www.youtube-nocookie.com/watch?v=j7EYGZt-CJc')).toBe('j7EYGZt-CJc');
  });

  // A malformed entry must not play something arbitrary.
  it('returns null for a non-YouTube URL', () => {
    expect(youtubeId('https://fundacioncnse-dilse.org/?buscar=leche')).toBeNull();
  });

  // Regression: a suffix test (`endsWith('youtube.com')`) accepted look-alike
  // hosts, which would have embedded a third party's player.
  it('rejects hosts that merely end in the YouTube domain', () => {
    expect(youtubeId('https://notyoutube.com/watch?v=j7EYGZt-CJc')).toBeNull();
    expect(youtubeId('https://evil-youtube.com/watch?v=j7EYGZt-CJc')).toBeNull();
    expect(youtubeId('https://youtube.com.attacker.test/watch?v=j7EYGZt-CJc')).toBeNull();
  });

  it('rejects a non-https URL', () => {
    expect(youtubeId('http://www.youtube.com/watch?v=j7EYGZt-CJc')).toBeNull();
    expect(youtubeId('javascript:alert(1)//youtube.com')).toBeNull();
  });

  it('returns null for a watch URL with no id', () => {
    expect(youtubeId('https://www.youtube.com/watch')).toBeNull();
  });

  it('returns null for anything that is not a URL', () => {
    expect(youtubeId('not a url')).toBeNull();
    expect(youtubeId('')).toBeNull();
  });
});

/**
 * The loader caches its promise in module scope, so each test imports a fresh
 * copy: a leaked cache from a previous test would mask exactly the bug these
 * cases exist for.
 */
async function freshLoader() {
  vi.resetModules();
  const module = await import('./youtube.ts');
  return module.loadYouTubeIframeApi;
}

function injectedScripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="iframe_api"]'));
}

describe('loadYouTubeIframeApi', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.head.replaceChildren();
    delete window.YT;
    delete window.onYouTubeIframeAPIReady;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Without this the dialog waits forever on a blank box when an extension or a
  // filtered network drops the request.
  it('rejects when the script fails to load', async () => {
    const load = await freshLoader();
    const pending = load();

    const script = injectedScripts()[0];
    expect(script).toBeDefined();
    script?.dispatchEvent(new Event('error'));

    await expect(pending).rejects.toThrow(/could not be loaded/);
  });

  it('rejects when the script never calls back', async () => {
    const load = await freshLoader();
    // The assertion is attached before the clock moves: the rejection would
    // otherwise be momentarily unhandled, which Node reports as an error.
    const pending = expect(load()).rejects.toThrow(/did not load/);

    await vi.advanceTimersByTimeAsync(YOUTUBE_API_TIMEOUT_MS);

    await pending;
  });

  it('lets a later attempt retry instead of reusing the failed result', async () => {
    const load = await freshLoader();

    const first = load();
    injectedScripts()[0]?.dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow();

    const second = load();
    expect(injectedScripts()).toHaveLength(1);

    // Resolve the retry so the promise is not left unhandled.
    window.YT = {
      Player: function Player() {} as never,
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
    };
    window.onYouTubeIframeAPIReady?.();
    await expect(second).resolves.toBeDefined();
  });

  it('does not fire the timeout once the API is ready', async () => {
    const load = await freshLoader();
    const pending = load();

    window.YT = {
      Player: function Player() {} as never,
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
    };
    window.onYouTubeIframeAPIReady?.();

    await expect(pending).resolves.toBeDefined();
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(pending).resolves.toBeDefined();
  });
});

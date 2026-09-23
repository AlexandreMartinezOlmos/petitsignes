import type { Page } from '@playwright/test';

/**
 * A stand-in for YouTube's IFrame Player API, served in place of the real
 * `iframe_api` script.
 *
 * The real player cannot be trusted to *play* in CI: from GitHub's runners
 * YouTube refuses the embed and fires `onError`, which is exactly what a
 * visitor on a blocked network would see. A test about what the dialog does
 * with a playing, ending or refused video therefore needs a player whose
 * behaviour it decides. Tests about what reaches the network or passes the
 * CSP keep using the real script — that is their whole point.
 *
 * The stand-in implements the slice of `YT.Player` the dialog uses and records
 * every call in `window.__ytCalls`, so a test can assert what the dialog asked
 * the player to do rather than inferring it from pixels.
 */
export interface StubBehaviour {
  /** Fire `onError` with this code once the player exists (100, 101, 150…). */
  error?: number;
  /** Fire `onStateChange(ENDED)` once the player is ready. */
  end?: boolean;
}

export async function stubYouTubeApi(page: Page, behaviour: StubBehaviour = {}): Promise<void> {
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `(() => {
        const behaviour = ${JSON.stringify(behaviour)};
        const calls = (window.__ytCalls = []);
        window.YT = {
          PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
          Player: function (element, options) {
            const frame = document.createElement('iframe');
            element.replaceWith(frame);
            const player = {
              setPlaybackRate: (rate) => calls.push('setPlaybackRate(' + rate + ')'),
              seekTo: (seconds) => calls.push('seekTo(' + seconds + ')'),
              playVideo: () => calls.push('playVideo'),
              stopVideo: () => calls.push('stopVideo'),
              getIframe: () => frame,
              destroy: () => { calls.push('destroy'); frame.remove(); },
            };
            setTimeout(() => {
              if (behaviour.error !== undefined) {
                options.events.onError({ target: player, data: behaviour.error });
                return;
              }
              options.events.onReady({ target: player, data: -1 });
              if (behaviour.end) options.events.onStateChange({ target: player, data: 0 });
            }, 0);
            return player;
          },
        };
        window.onYouTubeIframeAPIReady();
      })();`,
    }),
  );
}

/** What the dialog has asked the stand-in player to do so far. */
export function stubCalls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __ytCalls?: string[] }).__ytCalls ?? []);
}

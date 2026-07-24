/**
 * On-demand loader and minimal typings for the YouTube IFrame Player API.
 *
 * Why the full API instead of a bare `<iframe>`: it lets us listen for the
 * `ENDED` state and restart the clip ourselves, so a finished sign loops
 * reliably and the player never navigates away — which a plain embed's `loop`
 * parameter does not guarantee across browsers.
 *
 * Privacy: the script is injected only when a visitor actually opens a video
 * (never while browsing the catalogue), and the player is created against the
 * `youtube-nocookie.com` host, so the privacy posture matches the old embed.
 */

export const YOUTUBE_NOCOOKIE_HOST = 'https://www.youtube-nocookie.com';

/** The slice of `YT.Player` this app uses. */
export interface YouTubePlayer {
  setPlaybackRate(rate: number): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  stopVideo(): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

export interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data: number;
}

interface YouTubePlayerOptions {
  host?: string;
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: YouTubePlayerEvent) => void;
    onStateChange?: (event: YouTubePlayerEvent) => void;
  };
}

type YouTubePlayerConstructor = new (
  element: HTMLElement,
  options: YouTubePlayerOptions,
) => YouTubePlayer;

interface YouTubeApi {
  Player: YouTubePlayerConstructor;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

/** Loads the IFrame API once and resolves when `YT` is ready to use. */
export function loadYouTubeIframeApi(): Promise<YouTubeApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('The YouTube IFrame API is browser-only'));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);

  apiPromise ??= new Promise<YouTubeApi>((resolve) => {
    // Chain rather than overwrite: other callers may share the same global.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });

  return apiPromise;
}

/**
 * Extracts the video id from any YouTube URL shape the content uses. Returns
 * null rather than guessing, so a malformed entry simply does not play.
 */
export function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1) || null;
    if (parsed.hostname.endsWith('youtube.com')) return parsed.searchParams.get('v');
    return null;
  } catch {
    return null;
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { createTranslator } from '../lib/i18n.ts';
import { PLAY_EVENT, type PlayRequestDetail } from '../lib/catalogue-grid.ts';
import {
  YOUTUBE_NOCOOKIE_HOST,
  loadYouTubeIframeApi,
  youtubeId,
  type YouTubePlayer,
} from '../lib/youtube.ts';
import type { Language } from '../lib/types.ts';

interface Props {
  language: Language;
}

const SPEEDS = [0.5, 1] as const;
type Speed = (typeof SPEEDS)[number];

/**
 * Full-screen sign player (docs/requisitos.md §4.1, §8).
 *
 * The videos are not ours and may not be re-hosted, so this embeds the source's
 * own YouTube player through the IFrame API (see `lib/youtube.ts`). Using the
 * API rather than a bare embed lets us catch the `ENDED` state and restart the
 * clip, so a finished sign loops in place and the dialog never closes or
 * navigates on its own.
 *
 * A native <dialog> supplies focus trapping and Escape-to-close for free.
 */
export default function SignVideoDialog({ language }: Props) {
  const t = createTranslator(language);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [request, setRequest] = useState<PlayRequestDetail | null>(null);
  const [speed, setSpeed] = useState<Speed>(1);

  // Read inside the player's `onReady` callback without making the player
  // effect depend on speed (kept in sync by the speed effect below).
  const speedRef = useRef<Speed>(speed);

  // `request` is the single source of truth: setting it null closes the dialog
  // and tears the player down. We do NOT rely on the dialog's own `close` event,
  // which does not fire reliably while focus sits inside the YouTube iframe.
  const close = useCallback(() => setRequest(null), []);

  useEffect(() => {
    function onPlayRequest(event: Event): void {
      const detail = (event as CustomEvent<PlayRequestDetail>).detail;
      if (!detail?.videoUrl || youtubeId(detail.videoUrl) === null) return;
      setSpeed(1);
      setRequest(detail);
    }

    document.addEventListener(PLAY_EVENT, onPlayRequest);
    return () => document.removeEventListener(PLAY_EVENT, onPlayRequest);
  }, []);

  // Keep the native <dialog> in sync with the request state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    else if (!request && dialog.open) dialog.close();
  }, [request]);

  // Escape (when focus is not trapped in the iframe) fires `cancel`; keep the
  // state in step so the player is torn down too.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function onCancel(event: Event): void {
      event.preventDefault();
      setRequest(null);
    }

    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, []);

  const videoId = request ? youtubeId(request.videoUrl) : null;
  const videoTitle = request ? `${t('card.watchSign')}: ${request.label}` : '';

  // Create the player when a video is requested; destroy it when it is not.
  useEffect(() => {
    if (videoId === null) return;
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;

    void loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;

      // YT replaces the element it is given with an <iframe>, so hand it a
      // throwaway child rather than the React-owned container.
      const host = document.createElement('div');
      mountRef.current.appendChild(host);

      playerRef.current = new YT.Player(host, {
        host: YOUTUBE_NOCOOKIE_HOST,
        videoId,
        playerVars: {
          autoplay: 1,
          // Muted autoplay is the only kind browsers allow unprompted; sign
          // videos carry no audio, so nothing is lost.
          mute: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            event.target.setPlaybackRate(speedRef.current);
            event.target.getIframe().setAttribute('title', videoTitle);
          },
          onStateChange: (event) => {
            // Loop in place: restart instead of showing YouTube's end screen.
            if (event.data === YT.PlayerState.ENDED) {
              event.target.seekTo(0, true);
              event.target.playVideo();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      if (mount) mount.replaceChildren();
    };
  }, [videoId, videoTitle]);

  // Apply speed changes to the live player without rebuilding it, and keep the
  // ref current for a player that is still initialising.
  useEffect(() => {
    speedRef.current = speed;
    playerRef.current?.setPlaybackRate(speed);
  }, [speed]);

  return (
    // The onClick below closes the dialog when the backdrop is clicked: a click
    // outside the dialog's box lands on the <dialog> element itself, so this is
    // the only way to catch it. No keyboard equivalent is needed — a native
    // <dialog> already closes on Escape, and the header has a labelled close
    // button.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-label={request ? videoTitle : t('card.watchSign')}
      className="player-dialog"
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
    >
      {request && videoId && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3">
            <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{request.label}</h2>
            <button
              type="button"
              onClick={close}
              aria-label={t('player.close')}
              className="icon-button"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* The IFrame API replaces a child of this container with the player. */}
          <div ref={mountRef} className="player-dialog__stage" />

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div
              className="border-border flex rounded-(--radius-chip) border p-0.5"
              role="group"
              aria-label={t('player.speedNormal')}
            >
              {SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpeed(value)}
                  aria-pressed={speed === value}
                  className="chip-quiet"
                >
                  {value === 0.5 ? t('player.speedSlow') : t('player.speedNormal')}
                </button>
              ))}
            </div>

            {/* Per-entry attribution is required (docs/requisitos.md §5.3). */}
            <a
              href={request.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink-muted hover:text-ink ms-auto text-sm underline underline-offset-2"
            >
              {t('player.source')}: {request.source}
            </a>
          </div>
        </div>
      )}
    </dialog>
  );
}

/**
 * The hand-off between a card's play button and the video dialog.
 *
 * The two live on different schedules. The button is wired by a small page
 * script as soon as the document loads; the dialog is a React island hydrated
 * with `client:idle`, so it does not compete with the first paint. Until it
 * hydrates, nothing on the page can open it.
 *
 * This used to be a DOM event, and a DOM event has no memory: a tap in that
 * window — a fast visitor, a slow phone, a page opened from a link straight to
 * a sign — was dispatched to no listener and lost. The button looked dead.
 *
 * So the request is kept until someone can serve it. A request made before the
 * dialog subscribes waits as `pending`, and the dialog receives it the moment
 * it does. Only the latest one waits: two taps before hydration mean the
 * visitor changed their mind, and the player opens once, on the second.
 *
 * Both sides import this module, and the bundler gives every importer on a
 * page the same instance, which is what lets the two share `pending`.
 */

/** What the dialog needs to open, read from the button that asked for it. */
export interface PlayRequest {
  signId: string;
  label: string;
  signLanguage: string;
  videoUrl: string;
  posterUrl: string;
  source: string;
  sourceUrl: string;
  license: string;
}

export type PlayRequestListener = (request: PlayRequest) => void;

let listener: PlayRequestListener | null = null;
let pending: PlayRequest | null = null;

/**
 * Builds the request from a play button's dataset. Everything the dialog shows
 * travels on the button itself, so nothing here has to know which page, card
 * or view the button belongs to.
 */
export function readPlayRequest(button: Pick<HTMLElement, 'dataset'>, signId: string): PlayRequest {
  const { dataset } = button;
  return {
    signId,
    label: dataset.label ?? signId,
    signLanguage: dataset.signLanguage ?? '',
    videoUrl: dataset.videoUrl ?? '',
    posterUrl: dataset.posterUrl ?? '',
    source: dataset.source ?? '',
    sourceUrl: dataset.sourceUrl ?? '',
    license: dataset.license ?? '',
  };
}

/**
 * Asks the dialog to open. Delivered at once if it is listening, kept for it
 * otherwise.
 *
 * Does not count a play: this runs on every tap, before anything has been
 * validated. The dialog is what knows whether the request became a playable
 * video, so it is what counts.
 */
export function requestPlay(request: PlayRequest): void {
  if (listener) {
    listener(request);
    return;
  }
  pending = request;
}

/**
 * Subscribes the dialog. A request that arrived before it did is delivered
 * straight away, exactly once. Returns the unsubscribe function.
 *
 * One listener at a time, because a page has one dialog: a second subscriber
 * replaces the first rather than opening a second player over it.
 */
export function onPlayRequest(next: PlayRequestListener): () => void {
  listener = next;

  if (pending) {
    const request = pending;
    pending = null;
    next(request);
  }

  return () => {
    if (listener === next) listener = null;
  };
}

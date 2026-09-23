/**
 * The wiring every sign card needs, on any page that shows one.
 *
 * Kept apart from the catalogue's grid controller, which imports the search
 * index: the pages that show cards without a search box — a sign's own page,
 * a category, the 404 — load this and nothing of the search.
 */

import { ANALYTICS_EVENTS, countEvent } from './analytics.ts';
import { readPlayRequest, requestPlay } from './play-request.ts';
import {
  $favorites,
  $learned,
  hydrateFromStorage,
  toggleFavorite,
  toggleLearned,
} from './stores.ts';

function setToggleState(button: HTMLButtonElement, pressed: boolean): void {
  button.setAttribute('aria-pressed', String(pressed));
  const label = pressed ? button.dataset.labelOn : button.dataset.labelOff;
  if (label) button.setAttribute('aria-label', label);
}

/**
 * Wires the parts of a card that work wherever one is rendered: the two
 * progress toggles and the route to the video.
 *
 * Split out from the catalogue because the grid is not the only page that shows
 * a card — the 404 offers one too, and a toggle that silently did nothing there
 * would be the same broken promise once removed from the missing-video note,
 * which used to look like a disabled button. What
 * a single card needs is progress and playback; the filtering, the search index
 * and the section headings all belong to the grid and stay there.
 *
 * It lives in its own module, not beside the grid controller, because a module
 * is what the bundler ships whole: while this sat in `catalogue-grid.ts`, every
 * sign page, category page and 404 downloaded the search engine to wire two
 * toggles and a play button.
 */
export function mountSignCards(root: HTMLElement): () => void {
  const byId = new Map<string, HTMLElement>();
  // `data-progress-for` rather than `.sign-card`: a class is a look, and the
  // sign's own page shows the same two toggles without being a card. The
  // attribute states the contract instead — this element carries the progress
  // state of that id — so a third presentation needs no change here.
  for (const element of root.querySelectorAll<HTMLElement>('[data-progress-for]')) {
    const id = element.dataset.progressFor;
    if (id) byId.set(id, element);
  }

  function applyProgress(): void {
    const favorites = $favorites.get();
    const learned = $learned.get();

    for (const [id, element] of byId) {
      const isLearned = learned.includes(id);
      element.dataset.learned = String(isLearned);

      const favoriteButton = element.querySelector<HTMLButtonElement>('[data-action="favorite"]');
      if (favoriteButton) setToggleState(favoriteButton, favorites.includes(id));

      const learnedButton = element.querySelector<HTMLButtonElement>('[data-action="learned"]');
      if (learnedButton) setToggleState(learnedButton, isLearned);
    }
  }

  function onClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Leaving for the source dictionary is the LSE equivalent of playing a
    // video, and the only way to tell whether that delivery gets used at all.
    if (target.closest('a.sign-card__cta--external')) {
      countEvent(ANALYTICS_EVENTS.openLse);
      return;
    }

    const button = target.closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;

    const signId = button.dataset.signId;
    if (!signId) return;

    switch (button.dataset.action) {
      case 'favorite':
        // Only the additions: a count of removals says little, and the pair
        // would start to look like a per-visitor history.
        if (button.getAttribute('aria-pressed') !== 'true') {
          countEvent(ANALYTICS_EVENTS.addFavorite);
        }
        void toggleFavorite(signId);
        break;
      case 'learned':
        if (button.getAttribute('aria-pressed') !== 'true') {
          countEvent(ANALYTICS_EVENTS.markLearned);
        }
        void toggleLearned(signId);
        break;
      case 'play':
        requestPlay(readPlayRequest(button, signId));
        break;
    }
  }

  root.addEventListener('click', onClick);

  const unsubscribers = [$favorites.subscribe(applyProgress), $learned.subscribe(applyProgress)];

  void hydrateFromStorage();

  return () => {
    root.removeEventListener('click', onClick);
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

/**
 * Anonymous, aggregate usage counting (GoatCounter).
 *
 * What this is allowed to be, and what it must never become:
 *
 * - No cookies, no localStorage, no identifier of any kind. GoatCounter counts
 *   hits; it does not follow people between visits.
 * - Event names are a **closed set** declared below. Nothing a visitor types or
 *   chooses is ever sent — no search terms, no sign ids, no free-form strings.
 *   That is why `countEvent` takes `AnalyticsEvent` and not `string`: an
 *   accidental `countEvent(query)` must not compile.
 * - Everything is best-effort and optional. The script is absent in
 *   development, on preview deployments and whenever a visitor blocks it, so
 *   every call here has to be a silent no-op in that case. Analytics may never
 *   be load-bearing for a feature.
 *
 * The project page describes all of this to visitors, in these terms.
 */

/**
 * Every measurement the site can take. Deliberately coarse: each name answers
 * a question about the product, not about a person.
 */
export const ANALYTICS_EVENTS = {
  /** An LSC sign was played in the embedded player. */
  playLsc: 'video-lsc',
  /** An LSE sign was opened at the source dictionary instead. */
  openLse: 'enllac-lse',
  /** The player could not load and fell back to the source link. */
  playerUnavailable: 'reproductor-no-disponible',
  /** A sign was added to favourites (removals are not counted). */
  addFavorite: 'preferit-afegit',
  /** A sign was marked as learned (unmarking is not counted). */
  markLearned: 'apres-marcat',
  /** Progress was exported, imported or reset from the project page. */
  progressExported: 'progres-exportat',
  progressImported: 'progres-importat',
  progressReset: 'progres-reiniciat',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

interface GoatCounter {
  count(vars: { path: string; title?: string; event: true }): void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

/**
 * Records one event, or does nothing at all.
 *
 * Never throws and never awaits: a blocked or missing analytics script must be
 * indistinguishable, from the caller's point of view, from a successful count.
 */
export function countEvent(event: AnalyticsEvent): void {
  try {
    window.goatcounter?.count({ path: event, event: true });
  } catch {
    // An analytics failure is never worth breaking an interaction over.
  }
}

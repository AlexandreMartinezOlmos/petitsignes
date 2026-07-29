import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ANALYTICS_EVENTS, countEvent } from '../lib/analytics.ts';
import { createTranslator, type MessageKey, type Translator } from '../lib/i18n.ts';
import { downloadJson, progressFileName } from '../lib/progress-file.ts';
import { getProgressStore } from '../lib/stores.ts';
import type { Language } from '../lib/types.ts';

interface Props {
  language: Language;
  /**
   * Every sign id in the catalogue, from the page that renders this island.
   *
   * It is what lets an import drop words the vocabulary no longer has, and what
   * keeps the summary above the buttons honest: a retired id sits in storage
   * invisibly and would otherwise be counted forever. Roughly 1.2 kB of props on
   * this page and none on the catalogue, which is the page whose JavaScript
   * budget actually matters.
   */
  signIds: readonly string[];
}

interface Counts {
  favorites: number;
  learned: number;
}

type Feedback = { kind: 'status' | 'error'; message: string } | null;

/**
 * Same singular/plural convention the result count already uses: Catalan and
 * Spanish both need a different noun form for one, so a single template would
 * read "1 preferits".
 */
function count(t: Translator, value: number, one: MessageKey, many: MessageKey): string {
  return value === 1 ? t(one) : t(many, { count: value });
}

/** "2 preferits · 1 signe après" — the one phrasing used everywhere here. */
function summarise(t: Translator, counts: Counts): string {
  return [
    count(t, counts.favorites, 'progress.favoritesCountOne', 'progress.favoritesCount'),
    count(t, counts.learned, 'progress.learnedCountOne', 'progress.learnedCount'),
  ].join(' · ');
}

/**
 * Export, import and reset of the locally stored progress.
 *
 * The site has no accounts, so this file is the only way a visitor keeps their
 * favourites when they change device — and `localStorage` can be cleared by the
 * browser without warning. The controls live next to the "no accounts, nothing
 * leaves your device" promise on the project page, which is where that promise
 * needs to become actionable.
 *
 * Hydrated with `client:visible`: it costs nothing on the catalogue, which is
 * the page whose JavaScript budget actually matters.
 */
export default function ProgressData({ language, signIds }: Props) {
  const t = createTranslator(language);

  const knownIds = useMemo(() => new Set(signIds), [signIds]);

  // `null` until the store answers, not `{0, 0}`. Rendered on the server, that
  // placeholder read as "0 preferits · 0 signes apresos" — a rotund and false
  // number sitting right next to the export button, until the island hydrated.
  // The store calls back synchronously on subscribe, so the gap is the
  // `client:visible` wait and nothing more.
  const [counts, setCounts] = useState<Counts | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileInputId = useId();

  // The store notifies on every write, so the summary stays true after an
  // import or a reset without this component tracking the changes itself.
  //
  // Counted against the catalogue rather than as raw array lengths: the store is
  // deliberately catalogue-agnostic and keeps whatever it was given, so a sign
  // retired from the vocabulary stays in storage and would be counted here even
  // though no page can show it. Claiming "12 preferits" next to eleven visible
  // cards is a number the visitor cannot reconcile.
  useEffect(() => {
    const countKnown = (ids: readonly string[]) => ids.filter((id) => knownIds.has(id)).length;

    return getProgressStore().subscribe((snapshot) => {
      setCounts({
        favorites: countKnown(snapshot.favorites),
        learned: countKnown(snapshot.learned),
      });
    });
  }, [knownIds]);

  const onExport = useCallback(() => {
    void (async () => {
      const contents = await getProgressStore().export();
      downloadJson(contents, progressFileName());
      countEvent(ANALYTICS_EVENTS.progressExported);
    })();
  }, []);

  const onImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Clear the input straight away, so picking the same file twice in a row
      // still fires a change event.
      event.target.value = '';
      if (!file) return;

      void (async () => {
        try {
          const result = await getProgressStore().import(await file.text(), { knownIds });
          countEvent(ANALYTICS_EVENTS.progressImported);

          // What changed, not what the total now is: the summary line above
          // already shows the total, and after a merge the interesting number is
          // the one the file contributed. Saying "0 preferits i 0 apresos" would
          // be true and useless, so a file that adds nothing says so in words.
          const sentences =
            result.addedFavorites === 0 && result.addedLearned === 0
              ? [t('progress.importedNothing')]
              : [
                  t('progress.importedAdded', {
                    favorites: count(
                      t,
                      result.addedFavorites,
                      'progress.favoritesCountOne',
                      'progress.favoritesCount',
                    ),
                    learned: count(
                      t,
                      result.addedLearned,
                      'progress.learnedCountOne',
                      'progress.learnedCount',
                    ),
                  }),
                ];

          // Never silent: a dropped id is the one thing that makes the numbers
          // fail to add up, so it is stated rather than left to be noticed.
          if (result.skipped > 0) {
            sentences.push(
              result.skipped === 1
                ? t('progress.importedSkippedOne')
                : t('progress.importedSkipped', { count: result.skipped }),
            );
          }

          setFeedback({ kind: 'status', message: sentences.join(' ') });
        } catch {
          // Every failure mode here — malformed JSON, a foreign file, a newer
          // schema — is the same thing to the visitor: this file cannot be used.
          setFeedback({ kind: 'error', message: t('progress.importError') });
        }
      })();
    },
    [t, knownIds],
  );

  const onReset = useCallback(() => {
    // A native confirm cannot be missed and needs no focus management of our
    // own; the action is rare, irreversible and deserves the interruption.
    if (!window.confirm(t('progress.resetConfirm'))) return;

    void (async () => {
      await getProgressStore().reset();
      countEvent(ANALYTICS_EVENTS.progressReset);
      setFeedback({ kind: 'status', message: t('progress.resetDone') });
    })();
  }, [t]);

  return (
    // The heading belongs to the page, not to the island: it is one more
    // section of the article and it has to appear in its contents list like
    // the rest. What is left here is the panel itself.
    <section className="progress-data">
      <p>{t('progress.intro')}</p>
      {/* The class reserves the line so the summary appearing does not shift
          the buttons under it. */}
      <p className="progress-data__summary text-ink-muted mt-2 text-sm">
        {counts === null ? null : summarise(t, counts)}
      </p>

      <ul className="progress-data__actions">
        <li>
          <button type="button" className="progress-data__action" onClick={onExport}>
            {t('progress.export')}
          </button>
          <p className="progress-data__hint">{t('progress.exportHint')}</p>
        </li>

        <li>
          {/* A real file input with a real label: the native control is
              keyboard-accessible and announced correctly, which a div dressed
              up as a button is not. */}
          <label className="progress-data__action" htmlFor={fileInputId}>
            {t('progress.import')}
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="application/json,.json"
            className="progress-data__file"
            onChange={onImport}
          />
          <p className="progress-data__hint">{t('progress.importHint')}</p>
        </li>

        <li>
          <button type="button" className="progress-data__action" onClick={onReset}>
            {t('progress.reset')}
          </button>
          <p className="progress-data__hint">{t('progress.resetHint')}</p>
        </li>
      </ul>

      {/* Both live regions stay mounted so the announcement is reliable; only
          their text changes. */}
      <p className="progress-data__feedback" role="status">
        {feedback?.kind === 'status' ? feedback.message : ''}
      </p>
      <p className="progress-data__feedback" role="alert">
        {feedback?.kind === 'error' ? feedback.message : ''}
      </p>
    </section>
  );
}

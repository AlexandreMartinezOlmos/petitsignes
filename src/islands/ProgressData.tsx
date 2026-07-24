import { useCallback, useEffect, useId, useState } from 'react';
import { createTranslator, type MessageKey, type Translator } from '../lib/i18n.ts';
import { downloadJson, progressFileName } from '../lib/progress-file.ts';
import { getProgressStore } from '../lib/stores.ts';
import type { Language } from '../lib/types.ts';

interface Props {
  language: Language;
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
export default function ProgressData({ language }: Props) {
  const t = createTranslator(language);

  const [counts, setCounts] = useState<Counts>({ favorites: 0, learned: 0 });
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileInputId = useId();

  // The store notifies on every write, so the summary stays true after an
  // import or a reset without this component tracking the changes itself.
  useEffect(() => {
    return getProgressStore().subscribe((snapshot) => {
      setCounts({ favorites: snapshot.favorites.length, learned: snapshot.learned.length });
    });
  }, []);

  const onExport = useCallback(() => {
    void (async () => {
      const contents = await getProgressStore().export();
      downloadJson(contents, progressFileName());
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
          const store = getProgressStore();
          await store.import(await file.text());
          const [favorites, learned] = await Promise.all([
            store.getFavorites(),
            store.getLearned(),
          ]);
          setFeedback({
            kind: 'status',
            message: t('progress.imported', {
              summary: summarise(t, { favorites: favorites.length, learned: learned.length }),
            }),
          });
        } catch {
          // Every failure mode here — malformed JSON, a foreign file, a newer
          // schema — is the same thing to the visitor: this file cannot be used.
          setFeedback({ kind: 'error', message: t('progress.importError') });
        }
      })();
    },
    [t],
  );

  const onReset = useCallback(() => {
    // A native confirm cannot be missed and needs no focus management of our
    // own; the action is rare, irreversible and deserves the interruption.
    if (!window.confirm(t('progress.resetConfirm'))) return;

    void (async () => {
      await getProgressStore().reset();
      setFeedback({ kind: 'status', message: t('progress.resetDone') });
    })();
  }, [t]);

  return (
    <section className="progress-data">
      <h2 className="mt-8 text-xl font-bold">{t('progress.title')}</h2>
      <p className="mt-2">{t('progress.intro')}</p>
      <p className="text-ink-muted mt-2 text-sm">{summarise(t, counts)}</p>

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

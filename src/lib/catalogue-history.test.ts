import { describe, expect, it } from 'vitest';
import {
  CATALOGUE_STATE_KEY,
  DEFAULT_CATALOGUE_STATE,
  isDefaultCatalogueState,
  readCatalogueState,
  writeCatalogueState,
  type CatalogueState,
} from './catalogue-history.ts';

const FILTERED: CatalogueState = {
  query: 'llet',
  category: 'food',
  onlyFirstSigns: true,
  statusFilter: 'favorites',
};

function entry(stored: unknown): Record<string, unknown> {
  return { [CATALOGUE_STATE_KEY]: stored };
}

describe('reading a history entry', () => {
  it('brings back exactly what was stored', () => {
    expect(readCatalogueState(writeCatalogueState(null, FILTERED))).toEqual(FILTERED);
  });

  /**
   * `history.state` is shared with everything else that writes history for this
   * origin, so the absence of our envelope has to mean "not ours" rather than
   * "empty" — otherwise arriving on someone else's entry would silently reset
   * the catalogue as though the visitor had cleared their filters.
   */
  it('refuses an entry that is not ours', () => {
    expect(readCatalogueState(null)).toBeNull();
    expect(readCatalogueState('llet')).toBeNull();
    expect(readCatalogueState({})).toBeNull();
    expect(readCatalogueState({ query: 'llet' })).toBeNull();
    expect(readCatalogueState({ [CATALOGUE_STATE_KEY]: 'llet' })).toBeNull();
  });

  /**
   * The realistic case is a category that used to exist: a link from an older
   * deploy, or the category of a concept that has since been retired. Filtering
   * on it would empty the grid with nothing on screen explaining why, so the
   * value is dropped and the rest of the state still comes back.
   */
  it('drops a category the catalogue no longer has, and keeps the rest', () => {
    const state = readCatalogueState(entry({ ...FILTERED, category: 'dinosaurs' }));
    expect(state).toEqual({ ...FILTERED, category: null });
  });

  it('falls back to "all" for a status filter it does not recognise', () => {
    expect(readCatalogueState(entry({ statusFilter: 'mastered' }))?.statusFilter).toBe('all');
  });

  /** Anything that is not literally `true` is not a pressed chip. */
  it('only treats a real true as the first-signs filter', () => {
    expect(readCatalogueState(entry({ onlyFirstSigns: 'true' }))?.onlyFirstSigns).toBe(false);
    expect(readCatalogueState(entry({ onlyFirstSigns: 1 }))?.onlyFirstSigns).toBe(false);
    expect(readCatalogueState(entry({ onlyFirstSigns: true }))?.onlyFirstSigns).toBe(true);
  });

  it('ignores a query that is not a string', () => {
    expect(readCatalogueState(entry({ query: 42 }))?.query).toBe('');
    expect(readCatalogueState(entry({ query: ['llet'] }))?.query).toBe('');
  });

  /**
   * A history entry is not a place to park unbounded input. Nothing in the
   * catalogue is anywhere near this long, so the cap can only ever truncate a
   * paste, and it keeps the stored object a predictable size.
   */
  it('caps the query rather than storing whatever was pasted', () => {
    const state = readCatalogueState(entry({ query: 'a'.repeat(5000) }));
    expect(state?.query).toHaveLength(100);
  });
});

describe('writing a history entry', () => {
  /**
   * Other features — and other deploys of this one — may already have written to
   * this entry. Replacing the whole object instead of merging would make this
   * module the reason their data vanished.
   */
  it('keeps what someone else put on the same entry', () => {
    const written = writeCatalogueState({ scrollY: 1200 }, FILTERED);
    expect(written.scrollY).toBe(1200);
    expect(readCatalogueState(written)).toEqual(FILTERED);
  });

  it('survives a round trip through JSON, which is how the browser stores it', () => {
    const written = writeCatalogueState(null, FILTERED);
    expect(readCatalogueState(JSON.parse(JSON.stringify(written)))).toEqual(FILTERED);
  });
});

describe('recognising an untouched catalogue', () => {
  it('knows the state a first-time visitor arrives with', () => {
    expect(isDefaultCatalogueState(DEFAULT_CATALOGUE_STATE)).toBe(true);
  });

  /**
   * Each field on its own, because a single `!==` chain that forgot one would
   * still pass a test that only ever changed the query.
   */
  it('spots any single filter being set', () => {
    expect(isDefaultCatalogueState({ ...DEFAULT_CATALOGUE_STATE, query: 'llet' })).toBe(false);
    expect(isDefaultCatalogueState({ ...DEFAULT_CATALOGUE_STATE, category: 'food' })).toBe(false);
    expect(isDefaultCatalogueState({ ...DEFAULT_CATALOGUE_STATE, onlyFirstSigns: true })).toBe(
      false,
    );
    expect(isDefaultCatalogueState({ ...DEFAULT_CATALOGUE_STATE, statusFilter: 'learned' })).toBe(
      false,
    );
  });
});

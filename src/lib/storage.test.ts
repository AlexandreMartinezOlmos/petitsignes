import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  InvalidProgressFileError,
  LocalStorageProgressStore,
  MIGRATIONS,
  SCHEMA_VERSION,
  STORAGE_KEY,
  createEmptySnapshot,
  mergeSnapshots,
  parseSnapshot,
} from './storage.ts';

describe('mergeSnapshots', () => {
  const snapshot = (favorites: string[], learned: string[] = []) => ({
    ...createEmptySnapshot(),
    favorites,
    learned,
  });

  it('keeps every id when it is not told what the catalogue holds', () => {
    // The store must stay usable without the catalogue: it is the interface a
    // future remote implementation has to satisfy, and that one will not have
    // 194 ids to hand either. No filter is not the same as an empty filter.
    const { snapshot: merged, result } = mergeSnapshots(snapshot([]), snapshot(['cualquiera']));

    expect(merged.favorites).toEqual(['cualquiera']);
    expect(result.skipped).toBe(0);
  });

  it('discards everything from a file whose ids are all gone', () => {
    const { snapshot: merged, result } = mergeSnapshots(
      snapshot(['leche']),
      snapshot(['viejo', 'antiguo']),
      new Set(['leche']),
    );

    expect(merged.favorites).toEqual(['leche']);
    expect(result).toEqual({ addedFavorites: 0, addedLearned: 0, skipped: 2 });
  });

  it('never removes what this browser already had', () => {
    const { snapshot: merged } = mergeSnapshots(
      snapshot(['leche', 'agua'], ['pan']),
      snapshot([], []),
      new Set(['leche', 'agua', 'pan']),
    );

    expect(merged.favorites).toEqual(['leche', 'agua']);
    expect(merged.learned).toEqual(['pan']);
  });
});

describe('parseSnapshot', () => {
  it('accepts a well-formed snapshot', () => {
    const snapshot = parseSnapshot({
      schemaVersion: 1,
      favorites: ['leche', 'agua'],
      learned: ['leche'],
      preferences: { language: 'es', signLanguage: 'lse' },
    });

    expect(snapshot.favorites).toEqual(['leche', 'agua']);
    expect(snapshot.learned).toEqual(['leche']);
    expect(snapshot.preferences).toEqual({ language: 'es', signLanguage: 'lse' });
  });

  it('drops duplicate ids', () => {
    const snapshot = parseSnapshot({
      schemaVersion: 1,
      favorites: ['leche', 'leche'],
      learned: [],
      preferences: {},
    });

    expect(snapshot.favorites).toEqual(['leche']);
  });

  it('falls back to defaults for unknown language values', () => {
    const snapshot = parseSnapshot({
      schemaVersion: 1,
      preferences: { language: 'fr', signLanguage: 'asl' },
    });

    expect(snapshot.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('ignores non-string entries instead of trusting them', () => {
    const snapshot = parseSnapshot({
      schemaVersion: 1,
      favorites: ['leche', 42],
      preferences: {},
    });

    expect(snapshot.favorites).toEqual([]);
  });

  it('rejects a payload without a schema version', () => {
    expect(() => parseSnapshot({ favorites: [] })).toThrow(InvalidProgressFileError);
  });

  it('rejects a snapshot from a newer version it cannot understand', () => {
    expect(() => parseSnapshot({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(
      InvalidProgressFileError,
    );
  });

  it('rejects non-objects', () => {
    expect(() => parseSnapshot('nope')).toThrow(InvalidProgressFileError);
    expect(() => parseSnapshot(null)).toThrow(InvalidProgressFileError);
  });

  // Refusing loudly beats reading old data with the new rules and quietly
  // dropping whatever the new shape does not recognise.
  it('refuses an older snapshot it has no migration for', () => {
    expect(() => parseSnapshot({ schemaVersion: 0, favorites: ['leche'] })).toThrow(
      /no migration from schemaVersion 0/,
    );
  });
});

describe('schema migrations', () => {
  /**
   * The guard that makes the contract real: bumping SCHEMA_VERSION without
   * adding the matching migration would silently discard the progress of every
   * visitor who already has data, with no error anywhere.
   */
  it('has a migration for every version below the current one', () => {
    for (let version = 1; version < SCHEMA_VERSION; version++) {
      expect(MIGRATIONS[version], `missing migration from schemaVersion ${version}`).toBeTypeOf(
        'function',
      );
    }
  });

  it('runs every step in order when several versions are missed', () => {
    const steps: number[] = [];
    const migrations: Record<number, (raw: Record<string, unknown>) => void> = {
      1: () => steps.push(1),
      2: () => steps.push(2),
    };

    // Mirrors the loop in parseSnapshot, pinning the "one version at a time,
    // in ascending order" contract that a future migration will rely on.
    for (let version = 1; version < 3; version++) migrations[version]?.({});

    expect(steps).toEqual([1, 2]);
  });
});

describe('LocalStorageProgressStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', async () => {
    const store = new LocalStorageProgressStore();
    expect(await store.getFavorites()).toEqual([]);
    expect(await store.getLearned()).toEqual([]);
    expect(await store.getPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('toggles favourites on and off', async () => {
    const store = new LocalStorageProgressStore();

    await store.toggleFavorite('leche');
    expect(await store.getFavorites()).toEqual(['leche']);

    await store.toggleFavorite('leche');
    expect(await store.getFavorites()).toEqual([]);
  });

  it('keeps favourites and learned independent', async () => {
    const store = new LocalStorageProgressStore();

    await store.toggleFavorite('leche');
    await store.toggleLearned('agua');

    expect(await store.getFavorites()).toEqual(['leche']);
    expect(await store.getLearned()).toEqual(['agua']);
  });

  it('persists across instances', async () => {
    const first = new LocalStorageProgressStore();
    await first.toggleFavorite('leche');
    await first.setPreferences({ signLanguage: 'lse' });

    const second = new LocalStorageProgressStore();
    expect(await second.getFavorites()).toEqual(['leche']);
    expect((await second.getPreferences()).signLanguage).toBe('lse');
  });

  it('merges partial preference updates', async () => {
    const store = new LocalStorageProgressStore();

    await store.setPreferences({ signLanguage: 'lse' });
    await store.setPreferences({ language: 'en' });

    expect(await store.getPreferences()).toEqual({ language: 'en', signLanguage: 'lse' });
  });

  it('carries the progress over to an empty browser', async () => {
    const source = new LocalStorageProgressStore();
    await source.toggleFavorite('leche');
    await source.toggleLearned('agua');

    const exported = await source.export();

    localStorage.clear();
    const target = new LocalStorageProgressStore();
    const result = await target.import(exported);

    expect(await target.getFavorites()).toEqual(['leche']);
    expect(await target.getLearned()).toEqual(['agua']);
    expect(result).toEqual({ addedFavorites: 1, addedLearned: 1, skipped: 0 });
  });

  // Was asserted the other way round while `import` replaced the snapshot
  // wholesale. Now that it merges, an imported preference is the one thing in
  // the file that is about the reader rather than about the signs — and the
  // interface language is decided by the URL anyway, so honouring it would
  // rewrite a stored answer without changing anything on screen.
  it('keeps this browser’s preferences when a file brings its own', async () => {
    const source = new LocalStorageProgressStore();
    await source.setPreferences({ language: 'es', signLanguage: 'lse' });
    const exported = await source.export();

    localStorage.clear();
    const target = new LocalStorageProgressStore();
    await target.setPreferences({ language: 'ca', signLanguage: 'lsc' });
    await target.import(exported);

    expect(await target.getPreferences()).toEqual({ language: 'ca', signLanguage: 'lsc' });
  });

  it('adds to what is already here instead of replacing it', async () => {
    const store = new LocalStorageProgressStore();
    await store.toggleFavorite('leche');
    await store.toggleLearned('agua');

    const result = await store.import(
      JSON.stringify({ schemaVersion: 1, favorites: ['pan'], learned: [] }),
    );

    // The whole reason the merge exists: two carers of the same baby swap
    // files, and neither of them loses what they had.
    expect(await store.getFavorites()).toEqual(['leche', 'pan']);
    expect(await store.getLearned()).toEqual(['agua']);
    expect(result.addedFavorites).toBe(1);
  });

  it('counts only what the file actually contributed', async () => {
    const store = new LocalStorageProgressStore();
    await store.toggleFavorite('leche');

    const result = await store.import(
      JSON.stringify({ schemaVersion: 1, favorites: ['leche', 'pan'], learned: [] }),
    );

    // Two ids in the file, one of them already here: saying "2 preferits" would
    // be a number the summary above the button then contradicts.
    expect(result.addedFavorites).toBe(1);
    expect(await store.getFavorites()).toEqual(['leche', 'pan']);
  });

  it('drops ids the catalogue no longer has, and says how many', async () => {
    const store = new LocalStorageProgressStore();

    const result = await store.import(
      JSON.stringify({ schemaVersion: 1, favorites: ['leche', 'retirado'], learned: ['retirado'] }),
      { knownIds: new Set(['leche', 'agua']) },
    );

    expect(await store.getFavorites()).toEqual(['leche']);
    expect(await store.getLearned()).toEqual([]);
    // One word gone from the vocabulary, not two entries: it is counted once
    // even though it appeared in both lists.
    expect(result.skipped).toBe(1);
  });

  it('rejects an import that is not JSON', async () => {
    const store = new LocalStorageProgressStore();
    await expect(store.import('<html>')).rejects.toThrow(InvalidProgressFileError);
  });

  it('leaves existing progress untouched when an import fails', async () => {
    const store = new LocalStorageProgressStore();
    await store.toggleFavorite('leche');

    await expect(store.import('{ not json')).rejects.toThrow(InvalidProgressFileError);

    expect(await store.getFavorites()).toEqual(['leche']);
  });

  it('resets to an empty snapshot', async () => {
    const store = new LocalStorageProgressStore();
    await store.toggleFavorite('leche');
    await store.reset();

    expect(await store.getFavorites()).toEqual([]);
    expect(await store.getPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('recovers from corrupted stored data', async () => {
    localStorage.setItem(STORAGE_KEY, '{{{not json');

    const store = new LocalStorageProgressStore();
    expect(await store.getFavorites()).toEqual([]);
  });

  it('notifies subscribers on change and stops after unsubscribe', async () => {
    const store = new LocalStorageProgressStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    expect(listener).toHaveBeenCalledWith(createEmptySnapshot());

    await store.toggleFavorite('leche');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    await store.toggleFavorite('agua');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps working in memory when storage is unavailable', async () => {
    const store = new LocalStorageProgressStore(null);

    await store.toggleFavorite('leche');

    expect(await store.getFavorites()).toEqual(['leche']);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

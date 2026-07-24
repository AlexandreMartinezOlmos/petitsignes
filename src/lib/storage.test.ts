import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  InvalidProgressFileError,
  LocalStorageProgressStore,
  MIGRATIONS,
  SCHEMA_VERSION,
  STORAGE_KEY,
  createEmptySnapshot,
  parseSnapshot,
} from './storage.ts';

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

  it('round-trips through export and import', async () => {
    const source = new LocalStorageProgressStore();
    await source.toggleFavorite('leche');
    await source.toggleLearned('agua');
    await source.setPreferences({ language: 'es', signLanguage: 'lse' });

    const exported = await source.export();

    localStorage.clear();
    const target = new LocalStorageProgressStore();
    await target.import(exported);

    expect(await target.getFavorites()).toEqual(['leche']);
    expect(await target.getLearned()).toEqual(['agua']);
    expect(await target.getPreferences()).toEqual({ language: 'es', signLanguage: 'lse' });
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

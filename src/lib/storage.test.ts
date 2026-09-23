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

function storageEvent(key: string | null = STORAGE_KEY): StorageEvent {
  return new StorageEvent('storage', { key, storageArea: localStorage });
}

/**
 * Two tabs of the site share one `localStorage`, but each has its own store. In
 * a browser a write in one reaches the other as a `storage` event; jsdom only
 * delivers those to other windows, so the tests below dispatch them by hand.
 */
describe('LocalStorageProgressStore across tabs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Each tab used to save its own copy whole, so the second tab to save wrote
  // back a list without the first tab's star in it.
  it('keeps a change made in another tab when this one saves', async () => {
    const thisTab = new LocalStorageProgressStore();
    const otherTab = new LocalStorageProgressStore();

    await otherTab.toggleFavorite('leche');
    await thisTab.toggleLearned('agua');

    const reloaded = new LocalStorageProgressStore();
    expect(await reloaded.getFavorites()).toEqual(['leche']);
    expect(await reloaded.getLearned()).toEqual(['agua']);
  });

  it('toggles against what is stored, not against what this tab last saw', async () => {
    const thisTab = new LocalStorageProgressStore();
    const otherTab = new LocalStorageProgressStore();

    await otherTab.toggleFavorite('leche');
    // By the time anyone presses it here, the card already shows the star on:
    // the press means "take it away", and that is what has to happen.
    await thisTab.toggleFavorite('leche');

    expect(await new LocalStorageProgressStore().getFavorites()).toEqual([]);
  });

  it('tells its subscribers when another tab changes the progress', async () => {
    const thisTab = new LocalStorageProgressStore();
    const otherTab = new LocalStorageProgressStore();
    const listener = vi.fn();
    thisTab.subscribe(listener);

    await otherTab.toggleFavorite('leche');
    window.dispatchEvent(storageEvent());

    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ favorites: ['leche'] }));
    expect(await thisTab.getFavorites()).toEqual(['leche']);
  });

  it('empties when another tab clears the storage', async () => {
    const thisTab = new LocalStorageProgressStore();
    await thisTab.toggleFavorite('leche');

    localStorage.clear();
    window.dispatchEvent(storageEvent(null));

    expect(await thisTab.getFavorites()).toEqual([]);
  });

  it('ignores storage events about other keys', () => {
    const thisTab = new LocalStorageProgressStore();
    const listener = vi.fn();
    thisTab.subscribe(listener);

    window.dispatchEvent(storageEvent('someone-else'));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('exports what is stored, including another tab’s latest change', async () => {
    const thisTab = new LocalStorageProgressStore();
    await new LocalStorageProgressStore().toggleFavorite('leche');

    expect(JSON.parse(await thisTab.export()).favorites).toEqual(['leche']);
  });
});

/**
 * A stored block this version cannot read is not the same as no progress. It
 * used to be treated as such: the store started empty, and the first star the
 * visitor pressed wrote that empty list over everything they had.
 */
describe('LocalStorageProgressStore with data it cannot read', () => {
  // What a tab left open across a deploy would find, the day a new version of
  // the site stores a shape this one does not know.
  const fromNewerVersion = JSON.stringify({
    schemaVersion: SCHEMA_VERSION + 1,
    favorites: ['leche', 'agua'],
    learned: ['pan'],
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('never writes over a block from a newer version', async () => {
    localStorage.setItem(STORAGE_KEY, fromNewerVersion);
    const store = new LocalStorageProgressStore();

    await store.toggleFavorite('perro');
    await store.toggleLearned('perro');
    await store.setPreferences({ language: 'es' });
    await store.import(JSON.stringify({ schemaVersion: 1, favorites: ['gato'] }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe(fromNewerVersion);
  });

  it('never writes over a block it cannot parse', async () => {
    localStorage.setItem(STORAGE_KEY, '{{{not json');
    const store = new LocalStorageProgressStore();

    await store.toggleLearned('perro');

    expect(localStorage.getItem(STORAGE_KEY)).toBe('{{{not json');
  });

  it('keeps working in memory meanwhile', async () => {
    localStorage.setItem(STORAGE_KEY, fromNewerVersion);
    const store = new LocalStorageProgressStore();

    await store.toggleFavorite('perro');

    expect(await store.getFavorites()).toEqual(['perro']);
  });

  it('stops saving when another tab stores a block it cannot read', async () => {
    const store = new LocalStorageProgressStore();
    await store.toggleFavorite('leche');

    localStorage.setItem(STORAGE_KEY, fromNewerVersion);
    window.dispatchEvent(storageEvent());
    await store.toggleFavorite('perro');

    expect(localStorage.getItem(STORAGE_KEY)).toBe(fromNewerVersion);
  });

  it('saves again once the stored block is readable', async () => {
    localStorage.setItem(STORAGE_KEY, fromNewerVersion);
    const store = new LocalStorageProgressStore();

    // Another tab, on this version, erased and started again.
    await new LocalStorageProgressStore().reset();
    await store.toggleFavorite('perro');

    expect(await new LocalStorageProgressStore().getFavorites()).toEqual(['perro']);
  });

  // The visitor's way out when the data is damaged beyond reading. The project
  // page asks before it runs.
  it('lets a reset replace it, because erasing is what was asked for', async () => {
    localStorage.setItem(STORAGE_KEY, '{{{not json');
    const store = new LocalStorageProgressStore();

    await store.reset();
    await store.toggleFavorite('perro');

    expect(await new LocalStorageProgressStore().getFavorites()).toEqual(['perro']);
  });
});

describe('LocalStorageProgressStore when a write is refused', () => {
  it('keeps the change it could not save instead of rereading over it', async () => {
    let full = false;
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (full) throw new DOMException('quota', 'QuotaExceededError');
        saved.set(key, value);
      },
    } as unknown as Storage;
    const store = new LocalStorageProgressStore(storage);
    await store.toggleFavorite('leche');

    full = true;
    await store.toggleFavorite('agua');
    await store.toggleLearned('pan');

    expect(await store.getFavorites()).toEqual(['leche', 'agua']);
    expect(await store.getLearned()).toEqual(['pan']);
  });
});

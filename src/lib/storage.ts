/**
 * Local progress persistence.
 *
 * Everything goes through the `ProgressStore` interface — no component touches
 * `localStorage` directly. The methods are async from day one
 * so that a future remote implementation is a new class, not a rewrite.
 */

import {
  DEFAULT_LANGUAGE,
  DEFAULT_SIGN_LANGUAGE,
  LANGUAGES,
  SIGN_LANGUAGES,
  type Language,
  type SignLanguage,
} from './types.ts';

export const STORAGE_KEY = 'petitsignes:progress';

/**
 * Version of the persisted shape.
 *
 * Bumping this WITHOUT adding the matching entry to `MIGRATIONS` silently
 * discards the progress of everyone who already has data — `parseSnapshot`
 * would keep only the fields the new shape recognises, with no error and no
 * way back. The test suite enforces the pairing.
 */
export const SCHEMA_VERSION = 1;

/**
 * How to bring a snapshot from version N up to N+1. Keyed by the version being
 * migrated FROM, so upgrading runs `MIGRATIONS[1]`, then `MIGRATIONS[2]`, and
 * so on until the stored data reaches `SCHEMA_VERSION`.
 *
 * Empty today because version 1 is the first shape there has ever been. It
 * exists so that the day someone bumps the version, the place the migration
 * belongs is already here and already tested — that is cheaper than writing
 * speculative migrations for versions that do not exist yet.
 */
export const MIGRATIONS: Readonly<Record<number, (raw: Record<string, unknown>) => void>> = {};

export interface Preferences {
  /** Interface text language. */
  language: Language;
  /** Sign language of the videos. Independent axis. */
  signLanguage: SignLanguage;
}

export interface ProgressSnapshot {
  schemaVersion: number;
  favorites: string[];
  learned: string[];
  preferences: Preferences;
}

export interface ImportOptions {
  /**
   * The sign ids that still exist in the catalogue. Anything outside this set is
   * dropped from the file instead of being stored.
   *
   * Optional, and passed in rather than looked up, because this module knows
   * nothing about the catalogue and must not start to: the whole point of
   * `ProgressStore` is that a future remote store is a new class here, not a
   * rewrite of the app.
   * The caller has the collection; the store is merely told what is real.
   */
  knownIds?: ReadonlySet<string>;
}

/** What an import actually did, in the terms the visitor is told about. */
export interface ImportResult {
  addedFavorites: number;
  addedLearned: number;
  /**
   * Distinct ids in the file that are no longer in the catalogue. Counted once
   * each: a sign that was both a favourite and learned is one word gone from the
   * catalogue, not two, and that is what the message says.
   */
  skipped: number;
}

export interface ProgressStore {
  getFavorites(): Promise<string[]>;
  toggleFavorite(id: string): Promise<void>;
  getLearned(): Promise<string[]>;
  toggleLearned(id: string): Promise<void>;
  getPreferences(): Promise<Preferences>;
  setPreferences(preferences: Partial<Preferences>): Promise<void>;
  export(): Promise<string>;
  /**
   * Adds the contents of an exported file to what this browser already has.
   *
   * It merges rather than replaces. Replacing made importing a decision with a
   * cost — the honest hint had to warn that it would overwrite — and it made the
   * one case the feature exists for, two carers of the same baby swapping their
   * progress, destroy one of the two files. Merging cannot lose anything, so the
   * button is safe to press. Replacing is still available and still says what it
   * does: reset, then import.
   */
  import(json: string, options?: ImportOptions): Promise<ImportResult>;
  /**
   * Erases the progress. The one write allowed to replace stored data this
   * version cannot read: it is what the visitor asked for, and it is their way
   * out when that data is damaged beyond reading.
   */
  reset(): Promise<void>;
  /**
   * Calls the listener straight away with the current snapshot, then after every
   * change — including changes made somewhere else, such as another tab of the
   * same site. A page left open must not go on showing, and then saving, a
   * version of the progress that is no longer true.
   */
  subscribe(listener: (snapshot: ProgressSnapshot) => void): () => void;
}

export const DEFAULT_PREFERENCES: Preferences = {
  language: DEFAULT_LANGUAGE,
  signLanguage: DEFAULT_SIGN_LANGUAGE,
};

export function createEmptySnapshot(): ProgressSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    favorites: [],
    learned: [],
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

/** Thrown by `import()` when the payload is not a progress file we understand. */
export class InvalidProgressFileError extends Error {
  constructor(reason: string) {
    super(`Invalid progress file: ${reason}`);
    this.name = 'InvalidProgressFileError';
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Validates untrusted input (a file the user picked) into a snapshot.
 * Unknown fields are dropped rather than trusted.
 */
export function parseSnapshot(value: unknown): ProgressSnapshot {
  if (typeof value !== 'object' || value === null) {
    throw new InvalidProgressFileError('expected an object');
  }

  const raw = value as Record<string, unknown>;

  if (typeof raw.schemaVersion !== 'number') {
    throw new InvalidProgressFileError('missing schemaVersion');
  }
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new InvalidProgressFileError(
      `schemaVersion ${raw.schemaVersion} is newer than supported (${SCHEMA_VERSION})`,
    );
  }

  // Older data is brought forward one version at a time. Refusing loudly when a
  // step is missing is the point: silently reading an old snapshot with the new
  // rules would drop whatever the new shape does not recognise, and the visitor
  // would just find their favourites gone.
  for (let version = raw.schemaVersion; version < SCHEMA_VERSION; version++) {
    const migrate = MIGRATIONS[version];
    if (!migrate) {
      throw new InvalidProgressFileError(
        `no migration from schemaVersion ${version} to ${version + 1}`,
      );
    }
    migrate(raw);
  }

  const favorites = isStringArray(raw.favorites) ? uniqueStrings(raw.favorites) : [];
  const learned = isStringArray(raw.learned) ? uniqueStrings(raw.learned) : [];

  const rawPreferences =
    typeof raw.preferences === 'object' && raw.preferences !== null
      ? (raw.preferences as Record<string, unknown>)
      : {};

  const language = LANGUAGES.find((item) => item === rawPreferences.language);
  const signLanguage = SIGN_LANGUAGES.find((item) => item === rawPreferences.signLanguage);

  return {
    schemaVersion: SCHEMA_VERSION,
    favorites,
    learned,
    preferences: {
      language: language ?? DEFAULT_PREFERENCES.language,
      signLanguage: signLanguage ?? DEFAULT_PREFERENCES.signLanguage,
    },
  };
}

/**
 * Folds an imported snapshot into the one this browser already holds.
 *
 * Pure, so the rules below can be pinned without a browser or a file picker:
 *
 * - **Nothing local is ever removed.** The result is the union, which is what
 *   makes importing safe to press rather than a decision.
 * - **Ids the catalogue no longer has are dropped**, and counted so the visitor
 *   is told rather than left to wonder why the numbers do not add up. A word
 *   retired from the vocabulary would otherwise sit in storage forever, invisible
 *   on every page and yet counted in the summary.
 * - **Local preferences win.** The interface language is decided by the URL, so
 *   an imported one changes nothing on screen — but it would quietly rewrite the
 *   stored answer, and importing a friend's favourites is not a statement about
 *   what language you read the site in.
 */
export function mergeSnapshots(
  current: ProgressSnapshot,
  incoming: ProgressSnapshot,
  knownIds?: ReadonlySet<string>,
): { snapshot: ProgressSnapshot; result: ImportResult } {
  const skipped = new Set<string>();

  const keepKnown = (ids: readonly string[]): string[] =>
    ids.filter((id) => {
      if (knownIds === undefined || knownIds.has(id)) return true;
      skipped.add(id);
      return false;
    });

  const favorites = uniqueStrings([...current.favorites, ...keepKnown(incoming.favorites)]);
  const learned = uniqueStrings([...current.learned, ...keepKnown(incoming.learned)]);

  return {
    snapshot: { ...current, favorites, learned },
    result: {
      addedFavorites: favorites.length - current.favorites.length,
      addedLearned: learned.length - current.learned.length,
      skipped: skipped.size,
    },
  };
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

/**
 * `localStorage` is not always available: Safari private mode and some embedded
 * webviews throw on access. The store degrades to memory instead of crashing —
 * progress is lost on reload, but the app keeps working.
 */
function getAvailableStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = `${STORAGE_KEY}:probe`;
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * What is under `STORAGE_KEY`, as this version of the code sees it.
 *
 * `unreadable` is kept apart from `empty` on purpose. Treating a block that
 * cannot be parsed as "no progress yet" is how it used to be lost: the store
 * started from nothing, and the first star the visitor pressed wrote that
 * nothing over everything they had.
 */
type StoredProgress =
  { kind: 'empty' } | { kind: 'readable'; snapshot: ProgressSnapshot } | { kind: 'unreadable' };

function readStored(storage: Storage): StoredProgress {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { kind: 'empty' };
    return { kind: 'readable', snapshot: parseSnapshot(JSON.parse(raw)) };
  } catch {
    return { kind: 'unreadable' };
  }
}

export class LocalStorageProgressStore implements ProgressStore {
  /** `null` once there is nowhere to save: the store then works in memory. */
  #storage: Storage | null;
  readonly #listeners = new Set<(snapshot: ProgressSnapshot) => void>();
  #memory: ProgressSnapshot = createEmptySnapshot();
  /**
   * Set while the stored block is one this version cannot read. There are two
   * ways to get there, and neither is a reason to write over it:
   *
   * - **It comes from a newer version.** A tab left open across a deploy runs
   *   the old code against data the new code wrote. The data is fine; this tab
   *   is what is out of date, and a reload fixes it.
   * - **It is damaged.** Nothing here can repair it, but discarding it is the
   *   visitor's decision to take with `reset()`, not a side effect of pressing a
   *   star.
   *
   * Meanwhile the tab keeps working in memory, as it does when storage is
   * unavailable altogether.
   */
  #unreadable = false;

  constructor(storage: Storage | null = getAvailableStorage()) {
    this.#storage = storage;
    this.#refresh();

    // Another tab's writes reach this one as `storage` events on its window.
    // There is one store per page, so the listener lives as long as the page
    // does and is never removed.
    if (storage !== null && typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.storageArea !== this.#storage) return;
        // `key` is null when the whole area was cleared.
        if (event.key !== null && event.key !== STORAGE_KEY) return;
        this.#refresh();
        this.#notify();
      });
    }
  }

  /** Brings memory in line with what is stored, which another tab may have changed. */
  #refresh(): void {
    if (!this.#storage) return;

    const stored = readStored(this.#storage);
    this.#unreadable = stored.kind === 'unreadable';
    if (stored.kind === 'readable') this.#memory = stored.snapshot;
    if (stored.kind === 'empty') this.#memory = createEmptySnapshot();
  }

  /**
   * Applies a change to what is stored now, not to what this tab last saw.
   *
   * Each tab used to hold its own copy and save it whole, so two open tabs took
   * turns erasing each other: the second to save wrote back its stale copy, and
   * whatever the first had just added was gone. Re-reading first makes every
   * change land on top of the others.
   */
  #update(change: (current: ProgressSnapshot) => ProgressSnapshot): void {
    this.#refresh();
    this.#commit(change(this.#memory));
  }

  #commit(snapshot: ProgressSnapshot): void {
    this.#memory = snapshot;
    if (this.#storage && !this.#unreadable) {
      try {
        this.#storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Quota exceeded, or storage withdrawn mid-visit. From here on the tab
        // works in memory: re-reading storage before the next change would
        // otherwise throw away the one it could not save.
        this.#storage = null;
      }
    }
    this.#notify();
  }

  #notify(): void {
    for (const listener of this.#listeners) listener(this.#memory);
  }

  async getFavorites(): Promise<string[]> {
    return [...this.#memory.favorites];
  }

  async toggleFavorite(id: string): Promise<void> {
    this.#update((current) => ({ ...current, favorites: toggle(current.favorites, id) }));
  }

  async getLearned(): Promise<string[]> {
    return [...this.#memory.learned];
  }

  async toggleLearned(id: string): Promise<void> {
    this.#update((current) => ({ ...current, learned: toggle(current.learned, id) }));
  }

  async getPreferences(): Promise<Preferences> {
    return { ...this.#memory.preferences };
  }

  async setPreferences(preferences: Partial<Preferences>): Promise<void> {
    this.#update((current) => ({
      ...current,
      preferences: { ...current.preferences, ...preferences },
    }));
  }

  async export(): Promise<string> {
    // The file has to hold what is saved, including what another tab added a
    // moment ago, not this tab's last view of it.
    this.#refresh();
    return JSON.stringify(this.#memory, null, 2);
  }

  async import(json: string, options: ImportOptions = {}): Promise<ImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new InvalidProgressFileError('not valid JSON');
    }

    const incoming = parseSnapshot(parsed);
    this.#refresh();
    const { snapshot, result } = mergeSnapshots(this.#memory, incoming, options.knownIds);
    this.#commit(snapshot);
    return result;
  }

  async reset(): Promise<void> {
    // The one write allowed over a block this version cannot read (see
    // `#unreadable`): erasing it is exactly what was asked for.
    this.#unreadable = false;
    this.#commit(createEmptySnapshot());
  }

  subscribe(listener: (snapshot: ProgressSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#memory);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}

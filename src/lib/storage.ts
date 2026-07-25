/**
 * Local progress persistence.
 *
 * Everything goes through the `ProgressStore` interface — no component touches
 * `localStorage` directly (CLAUDE.md §4.1). The methods are async from day one
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
  /** Sign language of the videos. Independent axis (CLAUDE.md §4.2). */
  signLanguage: SignLanguage;
}

export interface ProgressSnapshot {
  schemaVersion: number;
  favorites: string[];
  learned: string[];
  preferences: Preferences;
}

export interface ProgressStore {
  getFavorites(): Promise<string[]>;
  toggleFavorite(id: string): Promise<void>;
  getLearned(): Promise<string[]>;
  toggleLearned(id: string): Promise<void>;
  getPreferences(): Promise<Preferences>;
  setPreferences(preferences: Partial<Preferences>): Promise<void>;
  export(): Promise<string>;
  import(json: string): Promise<void>;
  reset(): Promise<void>;
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

export class LocalStorageProgressStore implements ProgressStore {
  readonly #storage: Storage | null;
  readonly #listeners = new Set<(snapshot: ProgressSnapshot) => void>();
  #memory: ProgressSnapshot;

  constructor(storage: Storage | null = getAvailableStorage()) {
    this.#storage = storage;
    this.#memory = this.#read();
  }

  #read(): ProgressSnapshot {
    if (!this.#storage) return createEmptySnapshot();
    try {
      const raw = this.#storage.getItem(STORAGE_KEY);
      if (!raw) return createEmptySnapshot();
      return parseSnapshot(JSON.parse(raw));
    } catch {
      // Corrupted or foreign data: start clean rather than block the app.
      return createEmptySnapshot();
    }
  }

  #write(snapshot: ProgressSnapshot): void {
    this.#memory = snapshot;
    try {
      this.#storage?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota exceeded or storage disabled: keep the in-memory value.
    }
    for (const listener of this.#listeners) listener(snapshot);
  }

  async getSnapshot(): Promise<ProgressSnapshot> {
    return this.#memory;
  }

  async getFavorites(): Promise<string[]> {
    return [...this.#memory.favorites];
  }

  async toggleFavorite(id: string): Promise<void> {
    this.#write({ ...this.#memory, favorites: toggle(this.#memory.favorites, id) });
  }

  async getLearned(): Promise<string[]> {
    return [...this.#memory.learned];
  }

  async toggleLearned(id: string): Promise<void> {
    this.#write({ ...this.#memory, learned: toggle(this.#memory.learned, id) });
  }

  async getPreferences(): Promise<Preferences> {
    return { ...this.#memory.preferences };
  }

  async setPreferences(preferences: Partial<Preferences>): Promise<void> {
    this.#write({
      ...this.#memory,
      preferences: { ...this.#memory.preferences, ...preferences },
    });
  }

  async export(): Promise<string> {
    return JSON.stringify(this.#memory, null, 2);
  }

  async import(json: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new InvalidProgressFileError('not valid JSON');
    }
    this.#write(parseSnapshot(parsed));
  }

  async reset(): Promise<void> {
    this.#write(createEmptySnapshot());
  }

  subscribe(listener: (snapshot: ProgressSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#memory);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}

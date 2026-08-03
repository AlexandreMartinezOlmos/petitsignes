/**
 * Core domain types.
 *
 * The two language axes are deliberately separate and must never be derived
 * from one another:
 *   - `Language`     — the language of the interface TEXT.
 *   - `SignLanguage` — the SIGN language of the video.
 */

export const LANGUAGES = ['ca', 'es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'ca';

export const SIGN_LANGUAGES = ['lsc', 'lse'] as const;
export type SignLanguage = (typeof SIGN_LANGUAGES)[number];

export const DEFAULT_SIGN_LANGUAGE: SignLanguage = 'lsc';

/**
 * The interface language decides the sign language.
 *
 * These are still two distinct axes in the data model (a video is LSC or LSE
 * regardless of any UI), but for this audience they move together: a Catalan
 * speaker learns LSC, a Spanish speaker learns LSE. Choosing the interface
 * language therefore selects the sign language, and the choice lives in the URL
 * (`/` → ca/lsc, `/es/` → es/lse) so it is decided at build time — never from
 * client state, which keeps server and client markup identical.
 *
 * `en` has no sign language of its own in scope; it maps to LSE as a neutral
 * default for when an English interface is added.
 */
export const LANGUAGE_TO_SIGN_LANGUAGE: Record<Language, SignLanguage> = {
  ca: 'lsc',
  es: 'lse',
  en: 'lse',
};

export function signLanguageOf(language: Language): SignLanguage {
  return LANGUAGE_TO_SIGN_LANGUAGE[language];
}

/**
 * "First signs" is a curated path, not a category: those entries also belong
 * to a thematic category and are grouped separately by the `isFirstSign` flag.
 */
export const CATEGORY_IDS = [
  'food',
  'routines',
  'family',
  'emotions',
  'animals',
  'objects',
  'actions',
  'qualities',
  'nature',
  'courtesy',
  'body',
  'clothing',
  'colors',
  'numbers',
  'time',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/**
 * Every known video source. Adding one means adding its attribution too: the
 * prose in `CreditsView.astro` is hand-written per source, not generated from
 * this list.
 */
export const SIGN_SOURCES = ['CNSE-DILSE', 'Gencat-VocabulariLSC'] as const;
export type SignSource = (typeof SIGN_SOURCES)[number];

/**
 * How a video may legally be shown. The sources do not allow re-hosting, so
 * nothing is ever served from our own domain.
 *
 * - `youtube-embed` — the source published it on YouTube; embedding is the
 *   intended use. Loaded only after the user asks for it.
 * - `external-link`  — we may only link to the original entry. The card sends
 *   the user to the dictionary instead of playing anything.
 */
export const VIDEO_DELIVERIES = ['youtube-embed', 'external-link'] as const;
export type VideoDelivery = (typeof VIDEO_DELIVERIES)[number];

export type LocalizedText = Record<Language, string>;

export interface SignVideo {
  signLanguage: SignLanguage;
  delivery: VideoDelivery;
  /** YouTube watch URL, or the URL of the original dictionary entry. */
  videoUrl: string;
  /**
   * Still image of the gesture. Optional: without re-hosting rights we cannot
   * extract a frame, and inventing one is forbidden. When it is
   * missing the card shows a neutral category marker.
   */
  posterUrl?: string;
  source: SignSource;
  sourceUrl: string;
  license: string;
  updatedAt: string;
  /**
   * The lemma the source dictionary uses for this entry (e.g. Gencat's own
   * "Llit" for our "cama"). Attribution metadata for citation, not something
   * shown to the reader as if the sign varied by region.
   */
  sourceTerm?: string;
}

export interface SignEntry {
  id: string;
  labels: LocalizedText;
  category: CategoryId;
  isFirstSign: boolean;
  firstSignOrder?: number;
  videos: SignVideo[];
}

export interface Category {
  id: CategoryId;
  labels: LocalizedText;
  icon: string;
  order: number;
}

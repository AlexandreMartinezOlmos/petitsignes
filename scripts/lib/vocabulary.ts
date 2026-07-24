/**
 * Vocabulary manifest: the editable surface over the sign content.
 *
 * The build source of truth stays the per-sign JSON in `src/content/signs/`
 * (Astro's content collection, with full attribution per video). This module is
 * the round-trip between that JSON and a single flat table, `content/vocabulary.tsv`,
 * that a maintainer can edit in any spreadsheet to add or change a word.
 *
 * All functions here are pure — no file access — so the mapping is unit-tested.
 * The two thin scripts (`vocabulary-export.ts`, `vocabulary-import.ts`) do the IO.
 */

import {
  CATEGORY_IDS,
  type CategoryId,
  type LocalizedText,
  type SignVideo,
} from '../../src/lib/types.ts';

/** The stored shape of one sign file (its `id` comes from the filename). */
export interface SignData {
  labels: LocalizedText;
  category: CategoryId;
  isFirstSign: boolean;
  firstSignOrder?: number;
  difficulty?: 1 | 2 | 3;
  tips?: LocalizedText;
  videos: SignVideo[];
}

/** One editable row of the manifest. Everything a maintainer touches. */
export interface VocabularyRow {
  id: string;
  category: CategoryId;
  firstSignOrder: number | null;
  difficulty: 1 | 2 | 3 | null;
  ca: string;
  es: string;
  en: string;
  /** YouTube video ids for LSC, in order. First is the default shown. */
  lscYouTube: string[];
  /** DILSE search term for LSE, or '' for none. */
  lseDilseTerm: string;
}

export const TSV_COLUMNS = [
  'id',
  'category',
  'first_sign_order',
  'difficulty',
  'ca',
  'es',
  'en',
  'lsc_youtube',
  'lse_dilse_term',
] as const;

/** Boilerplate that the maintainer never types; filled in per language on import. */
export const LSC_SOURCE_URL =
  'https://llengua.gencat.cat/ca/llengua_signes_catalana/recursos-i-activitats/vocabulari/';
export const LSC_LICENSE =
  'Vocabulari bàsic de la LSC (Generalitat de Catalunya, Departament de Cultura, amb assessorament de la FESOCA). Reutilització segons la Llei 19/2014, art. 17.1, citant font i data.';
export const LSE_LICENSE =
  'DILSE, Fundación CNSE. Enllaç a la cerca de la fitxa original; el projecte només hi enllaça, no allotja ni transforma el vídeo.';

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function dilseSearchUrl(term: string): string {
  return `https://fundacioncnse-dilse.org/?buscar=${encodeURIComponent(term)}`;
}

/** Reads the YouTube id back out of a stored watch URL (null if it is not one). */
export function youTubeIdFromUrl(url: string): string | null {
  const match = url.match(/[?&]v=([\w-]{6,})/);
  return match?.[1] ?? null;
}

/** Reads the DILSE search term back out of a stored search URL. */
export function dilseTermFromUrl(url: string): string {
  try {
    return new URL(url).searchParams.get('buscar') ?? '';
  } catch {
    return '';
  }
}

// --- JSON -> row ----------------------------------------------------------

export function entryToRow(id: string, data: SignData): VocabularyRow {
  const lsc = data.videos.filter((v) => v.signLanguage === 'lsc');
  const lse = data.videos.find((v) => v.signLanguage === 'lse');
  return {
    id,
    category: data.category,
    firstSignOrder: data.firstSignOrder ?? null,
    difficulty: data.difficulty ?? null,
    ca: data.labels.ca,
    es: data.labels.es,
    en: data.labels.en,
    lscYouTube: lsc.map((v) => youTubeIdFromUrl(v.videoUrl) ?? '').filter(Boolean),
    lseDilseTerm: lse ? dilseTermFromUrl(lse.videoUrl) : '',
  };
}

// --- row -> JSON (merge) --------------------------------------------------

function lscVideo(id: string, existing: SignVideo | undefined, today: string): SignVideo {
  return {
    signLanguage: 'lsc',
    delivery: 'youtube-embed',
    videoUrl: youtubeWatchUrl(id),
    source: 'Gencat-VocabulariLSC',
    sourceUrl: LSC_SOURCE_URL,
    license: LSC_LICENSE,
    // Preserve a human's verification and variant label when the id is unchanged.
    updatedAt: existing?.updatedAt ?? today,
    status: existing?.status ?? 'draft',
    ...(existing?.variant !== undefined ? { variant: existing.variant } : {}),
  };
}

function lseVideo(term: string, existing: SignVideo | undefined, today: string): SignVideo {
  const url = dilseSearchUrl(term);
  const unchanged = existing?.videoUrl === url;
  return {
    signLanguage: 'lse',
    delivery: 'external-link',
    videoUrl: url,
    source: 'CNSE-DILSE',
    sourceUrl: url,
    license: LSE_LICENSE,
    updatedAt: unchanged ? (existing?.updatedAt ?? today) : today,
    status: unchanged ? (existing?.status ?? 'draft') : 'draft',
  };
}

/**
 * Merges a manifest row into an existing entry (or creates one). Videos are
 * rebuilt from the row's ids/term, but verification status and variant labels
 * survive whenever the id/term is unchanged. Non-video fields the manifest does
 * not carry (`tips`) are kept.
 */
export function applyRow(row: VocabularyRow, existing: SignData | null, today: string): SignData {
  const previousLsc = new Map(
    (existing?.videos ?? [])
      .filter((v) => v.signLanguage === 'lsc')
      .map((v) => [youTubeIdFromUrl(v.videoUrl) ?? '', v]),
  );
  const previousLse = existing?.videos.find((v) => v.signLanguage === 'lse');

  const videos: SignVideo[] = [
    ...row.lscYouTube.map((id) => lscVideo(id, previousLsc.get(id), today)),
    ...(row.lseDilseTerm ? [lseVideo(row.lseDilseTerm, previousLse, today)] : []),
  ];

  return {
    labels: { ca: row.ca, es: row.es, en: row.en },
    category: row.category,
    isFirstSign: row.firstSignOrder !== null,
    ...(row.firstSignOrder !== null ? { firstSignOrder: row.firstSignOrder } : {}),
    ...(row.difficulty !== null ? { difficulty: row.difficulty } : {}),
    ...(existing?.tips !== undefined ? { tips: existing.tips } : {}),
    videos,
  };
}

// --- TSV serialisation ----------------------------------------------------

function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

export function serializeTsv(rows: VocabularyRow[]): string {
  const header = TSV_COLUMNS.join('\t');
  const body = rows.map((row) =>
    [
      row.id,
      row.category,
      row.firstSignOrder ?? '',
      row.difficulty ?? '',
      row.ca,
      row.es,
      row.en,
      row.lscYouTube.join(','),
      row.lseDilseTerm,
    ].join('\t'),
  );
  return [header, ...body].join('\n') + '\n';
}

export class TsvError extends Error {}

function parseIntOrNull(value: string, field: string, id: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n)) throw new TsvError(`Row "${id}": ${field} must be an integer`);
  return n;
}

export function parseTsv(text: string): VocabularyRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  const headerLine = lines[0];
  if (headerLine === undefined) throw new TsvError('The manifest is empty');

  const header = headerLine.split('\t');
  if (header.join('\t') !== TSV_COLUMNS.join('\t')) {
    throw new TsvError(`Unexpected header. Expected: ${TSV_COLUMNS.join(', ')}`);
  }

  const seen = new Set<string>();
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const [
      id = '',
      category = '',
      order = '',
      difficulty = '',
      ca = '',
      es = '',
      en = '',
      lsc = '',
      lse = '',
    ] = cells.map((c) => c ?? '');

    if (!id.trim()) throw new TsvError('A row has no id');
    if (seen.has(id)) throw new TsvError(`Duplicate id "${id}"`);
    seen.add(id);
    if (!isCategoryId(category)) throw new TsvError(`Row "${id}": unknown category "${category}"`);
    if (!ca.trim() || !es.trim() || !en.trim()) {
      throw new TsvError(`Row "${id}": every label (ca, es, en) is required`);
    }

    const difficultyValue = parseIntOrNull(difficulty, 'difficulty', id);
    if (difficultyValue !== null && ![1, 2, 3].includes(difficultyValue)) {
      throw new TsvError(`Row "${id}": difficulty must be 1, 2 or 3`);
    }

    return {
      id: id.trim(),
      category,
      firstSignOrder: parseIntOrNull(order, 'first_sign_order', id),
      difficulty: difficultyValue as 1 | 2 | 3 | null,
      ca: ca.trim(),
      es: es.trim(),
      en: en.trim(),
      lscYouTube: lsc
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      lseDilseTerm: lse.trim(),
    };
  });
}

import { describe, expect, it } from 'vitest';
import {
  TsvError,
  applyRow,
  dilseTermFromUrl,
  entryToRow,
  parseTsv,
  serializeTsv,
  youTubeIdFromUrl,
  type SignData,
  type VocabularyRow,
} from './vocabulary.ts';

const TODAY = '2026-07-24';

function row(overrides: Partial<VocabularyRow> = {}): VocabularyRow {
  return {
    id: 'gato',
    category: 'animals',
    firstSignOrder: null,
    difficulty: null,
    ca: 'gat',
    es: 'gato',
    en: 'cat',
    lscYouTube: ['kXZylIjwSJI'],
    lseDilseTerm: 'gato',
    ...overrides,
  };
}

describe('url helpers', () => {
  it('reads a YouTube id back from a watch URL', () => {
    expect(youTubeIdFromUrl('https://www.youtube.com/watch?v=kXZylIjwSJI')).toBe('kXZylIjwSJI');
    expect(youTubeIdFromUrl('https://fundacioncnse-dilse.org/?buscar=gato')).toBeNull();
  });

  it('reads a DILSE term back from a search URL', () => {
    expect(dilseTermFromUrl('https://fundacioncnse-dilse.org/?buscar=buenos%20d%C3%ADas')).toBe(
      'buenos días',
    );
  });
});

describe('applyRow', () => {
  it('builds LSC and LSE videos with the right delivery and source', () => {
    const data = applyRow(row(), null, TODAY);
    const lsc = data.videos.find((v) => v.signLanguage === 'lsc')!;
    const lse = data.videos.find((v) => v.signLanguage === 'lse')!;

    expect(lsc.delivery).toBe('youtube-embed');
    expect(lsc.videoUrl).toContain('watch?v=kXZylIjwSJI');
    expect(lsc.source).toBe('Gencat-VocabulariLSC');

    expect(lse.delivery).toBe('external-link');
    expect(lse.videoUrl).toContain('buscar=gato');
    expect(lse.source).toBe('CNSE-DILSE');
  });

  it('marks a first sign from its order', () => {
    const data = applyRow(row({ firstSignOrder: 3 }), null, TODAY);
    expect(data.isFirstSign).toBe(true);
    expect(data.firstSignOrder).toBe(3);
  });

  it('omits a video block that the row leaves empty', () => {
    const data = applyRow(row({ lseDilseTerm: '', lscYouTube: [] }), null, TODAY);
    expect(data.videos).toEqual([]);
  });

  it('keeps the variant label and the recorded date when the id is unchanged', () => {
    const existing: SignData = {
      labels: { ca: 'gat', es: 'gato', en: 'cat' },
      category: 'animals',
      isFirstSign: false,
      videos: [
        {
          signLanguage: 'lsc',
          delivery: 'youtube-embed',
          videoUrl: 'https://www.youtube.com/watch?v=kXZylIjwSJI',
          source: 'Gencat-VocabulariLSC',
          sourceUrl: 'x',
          license: 'x',
          updatedAt: '2020-01-01',
          variant: 'Gat / gata',
        },
      ],
    };
    const data = applyRow(row(), existing, TODAY);
    const lsc = data.videos.find((v) => v.signLanguage === 'lsc')!;
    expect(lsc.variant).toBe('Gat / gata');
    expect(lsc.updatedAt).toBe('2020-01-01');
  });

  it('re-dates the LSE video when its search term changes', () => {
    const existing: SignData = {
      labels: { ca: 'gat', es: 'gato', en: 'cat' },
      category: 'animals',
      isFirstSign: false,
      videos: [
        {
          signLanguage: 'lse',
          delivery: 'external-link',
          videoUrl: 'https://fundacioncnse-dilse.org/?buscar=felino',
          source: 'CNSE-DILSE',
          sourceUrl: 'x',
          license: 'x',
          updatedAt: '2020-01-01',
        },
      ],
    };
    const data = applyRow(row({ lseDilseTerm: 'gato' }), existing, TODAY);
    const lse = data.videos.find((v) => v.signLanguage === 'lse')!;
    // A different term is a different source entry, so the date it carries is
    // the day this link was recorded, not the day the old one was.
    expect(lse.videoUrl).toContain('buscar=gato');
    expect(lse.updatedAt).toBe(TODAY);
  });

  it('preserves tips it does not manage', () => {
    const existing: SignData = {
      labels: { ca: 'gat', es: 'gato', en: 'cat' },
      category: 'animals',
      isFirstSign: false,
      tips: { ca: 't', es: 't', en: 't' },
      videos: [],
    };
    const data = applyRow(row(), existing, TODAY);
    expect(data.tips).toEqual({ ca: 't', es: 't', en: 't' });
  });
});

describe('tsv round-trip', () => {
  it('survives serialize -> parse unchanged', () => {
    const rows = [
      row(),
      row({
        id: 'leche',
        category: 'food',
        firstSignOrder: 1,
        difficulty: 1,
        lscYouTube: ['a1b2c3d4e5f', 'z9y8x7w6v5u'],
      }),
    ];
    expect(parseTsv(serializeTsv(rows))).toEqual(rows);
  });

  it('entryToRow and applyRow are inverse for the video ids', () => {
    const data = applyRow(row({ lscYouTube: ['kXZylIjwSJI'] }), null, TODAY);
    const back = entryToRow('gato', data);
    expect(back.lscYouTube).toEqual(['kXZylIjwSJI']);
    expect(back.lseDilseTerm).toBe('gato');
  });

  it('rejects an unknown category', () => {
    const tsv = serializeTsv([row()]).replace('animals', 'not-a-category');
    expect(() => parseTsv(tsv)).toThrow(TsvError);
  });

  it('rejects a duplicate id', () => {
    expect(() => parseTsv(serializeTsv([row(), row()]))).toThrow(/Duplicate/);
  });

  it('rejects a missing label', () => {
    const tsv = serializeTsv([row({ en: 'cat' })]).replace('\tcat\t', '\t\t');
    expect(() => parseTsv(tsv)).toThrow(TsvError);
  });

  it('rejects a bad difficulty', () => {
    expect(() => parseTsv(serializeTsv([row()]).replace('\t\tgat', '\t9\tgat'))).toThrow(TsvError);
  });
});

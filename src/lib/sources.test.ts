import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { provenanceProblems } from './sources.ts';
import type { SignVideo } from './types.ts';

const LSC = {
  source: 'Gencat-VocabulariLSC',
  signLanguage: 'lsc',
  delivery: 'youtube-embed',
  videoUrl: 'https://www.youtube.com/watch?v=j7EYGZt-CJc',
  sourceUrl:
    'https://llengua.gencat.cat/ca/llengua_signes_catalana/recursos-i-activitats/vocabulari/',
} as const;

const LSE = {
  source: 'CNSE-DILSE',
  signLanguage: 'lse',
  delivery: 'external-link',
  videoUrl: 'https://fundacioncnse-dilse.org/?buscar=leche',
  sourceUrl: 'https://fundacioncnse-dilse.org/?buscar=leche',
} as const;

describe('provenanceProblems', () => {
  it('accepts each source as it is actually used', () => {
    expect(provenanceProblems(LSC)).toEqual([]);
    expect(provenanceProblems(LSE)).toEqual([]);
  });

  // The failure that matters most: the two languages sign differently, so a
  // video filed under the wrong one teaches the wrong gesture.
  it('refuses a video labelled with the other sign language', () => {
    expect(provenanceProblems({ ...LSC, signLanguage: 'lse' })).toEqual([
      'Gencat-VocabulariLSC publishes LSC, not LSE',
    ]);
    expect(provenanceProblems({ ...LSE, signLanguage: 'lsc' })).toEqual([
      'CNSE-DILSE publishes LSE, not LSC',
    ]);
  });

  it('refuses a DILSE link filed under the Generalitat', () => {
    expect(provenanceProblems({ ...LSC, videoUrl: LSE.videoUrl })).toEqual([
      `Gencat-VocabulariLSC videoUrl must be a YouTube video URL: ${LSE.videoUrl}`,
    ]);
  });

  it('refuses a YouTube video attributed to DILSE', () => {
    expect(provenanceProblems({ ...LSE, videoUrl: LSC.videoUrl })).toEqual([
      `CNSE-DILSE videoUrl must be a fundacioncnse-dilse.org URL: ${LSC.videoUrl}`,
    ]);
  });

  // DILSE does not allow embedding; an embed would put its video on this site.
  it('refuses to embed what may only be linked', () => {
    expect(provenanceProblems({ ...LSE, delivery: 'youtube-embed' })).toEqual([
      'CNSE-DILSE videos are delivered as "external-link"',
    ]);
  });

  it('refuses an attribution that sends the reader elsewhere', () => {
    expect(provenanceProblems({ ...LSC, sourceUrl: 'https://example.com/' })).toEqual([
      'Gencat-VocabulariLSC sourceUrl must be on llengua.gencat.cat: https://example.com/',
    ]);
  });

  it('refuses a look-alike host', () => {
    const lookalike = 'https://fundacioncnse-dilse.org.example.com/?buscar=leche';
    expect(provenanceProblems({ ...LSE, videoUrl: lookalike, sourceUrl: lookalike })).toHaveLength(
      2,
    );
  });
});

/**
 * The schema runs the same check at build time, but a failing build names one
 * file at a time. This reads the collection off disk, the bytes that ship, and
 * lists every video that disagrees with its source at once.
 */
describe('the sign collection', () => {
  const dir = 'src/content/signs';
  const videos = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => {
      const data = JSON.parse(readFileSync(join(dir, name), 'utf8')) as { videos: SignVideo[] };
      return data.videos.map((video) => ({ name, video }));
    });

  it('has videos to check', () => {
    expect(videos.length).toBeGreaterThan(0);
  });

  it('attributes every video to a source that publishes it', () => {
    const problems = videos.flatMap(({ name, video }) =>
      provenanceProblems(video).map((problem) => `${name}: ${problem}`),
    );
    expect(problems).toEqual([]);
  });
});

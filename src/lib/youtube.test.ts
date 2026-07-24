import { describe, expect, it } from 'vitest';
import { youtubeId } from './youtube.ts';

describe('youtubeId', () => {
  it('reads the id from a short youtu.be link', () => {
    expect(youtubeId('https://youtu.be/j7EYGZt-CJc')).toBe('j7EYGZt-CJc');
  });

  it('reads the id from a watch URL', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=j7EYGZt-CJc')).toBe('j7EYGZt-CJc');
  });

  it('keeps ids that contain dashes and underscores', () => {
    expect(youtubeId('https://youtu.be/18xWl17R__E')).toBe('18xWl17R__E');
  });

  // A malformed entry must not play something arbitrary (CLAUDE.md §2.1).
  it('returns null for a non-YouTube URL', () => {
    expect(youtubeId('https://fundacioncnse-dilse.org/?buscar=leche')).toBeNull();
  });

  it('returns null for a watch URL with no id', () => {
    expect(youtubeId('https://www.youtube.com/watch')).toBeNull();
  });

  it('returns null for anything that is not a URL', () => {
    expect(youtubeId('not a url')).toBeNull();
    expect(youtubeId('')).toBeNull();
  });
});

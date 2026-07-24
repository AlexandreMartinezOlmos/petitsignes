import { describe, expect, it } from 'vitest';
import { PROGRESS_FILE_PREFIX, progressFileName } from './progress-file.ts';

describe('progressFileName', () => {
  it('dates the file so successive exports do not overwrite each other', () => {
    expect(progressFileName(new Date('2026-07-24T22:15:00Z'))).toBe(
      `${PROGRESS_FILE_PREFIX}-2026-07-24.json`,
    );
  });

  it('pads month and day, so names sort chronologically', () => {
    expect(progressFileName(new Date('2026-01-05T00:00:00Z'))).toBe(
      `${PROGRESS_FILE_PREFIX}-2026-01-05.json`,
    );
  });

  // A filename with a colon or a slash is rejected by some operating systems,
  // which would make the export unusable exactly when it is needed.
  it('contains nothing a file system would reject', () => {
    expect(progressFileName()).toMatch(/^[a-z0-9-]+\.json$/);
  });
});

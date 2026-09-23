import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SignFileError, readSignFile } from './sign-file.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'petitsignes-signs-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('readSignFile', () => {
  it('reads an existing sign', async () => {
    await writeFile(path.join(dir, 'gato.json'), JSON.stringify({ category: 'animals' }));

    expect(await readSignFile(dir, 'gato')).toEqual({ category: 'animals' });
  });

  it('answers null for a sign that has no file yet', async () => {
    expect(await readSignFile(dir, 'gato')).toBeNull();
  });

  // The import used to take this for a new concept and rebuild the file from the
  // manifest row, overwriting the lemma and dates only the JSON had. A merge
  // conflict left in a sign file is enough to cause it.
  it('refuses a file that does not parse, and names it', async () => {
    await writeFile(path.join(dir, 'gato.json'), '<<<<<<< HEAD\n{}\n');

    const reading = readSignFile(dir, 'gato');

    await expect(reading).rejects.toThrow(SignFileError);
    await expect(reading).rejects.toThrow(/gato\.json is not valid JSON/);
  });

  it('refuses a file it cannot read instead of treating it as missing', async () => {
    // A directory where the file should be: exists, and cannot be read as text.
    await mkdir(path.join(dir, 'gato.json'));

    await expect(readSignFile(dir, 'gato')).rejects.toThrow(/Cannot read .*gato\.json/);
  });
});

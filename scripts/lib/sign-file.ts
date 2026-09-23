/**
 * Reading one sign's JSON for the vocabulary import.
 *
 * Kept apart from `vocabulary.ts`, which is pure by design: this is the one
 * decision in the import that depends on the file system, and it is the one
 * that used to go wrong.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SignData } from './vocabulary.ts';

export class SignFileError extends Error {}

/**
 * The sign's current data, or `null` when it has no file yet.
 *
 * Only a missing file means "a new concept". Any other failure used to mean the
 * same: a file that did not parse, or could not be read, came back as `null`,
 * and the import rebuilt it from the manifest row alone. What exists only in the
 * JSON — the source dictionary's lemma, the date each video was recorded — was
 * overwritten without a word. Now the import stops and names the file.
 */
export async function readSignFile(dir: string, id: string): Promise<SignData | null> {
  const file = path.join(dir, `${id}.json`);

  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new SignFileError(`Cannot read ${file}`, { cause: error });
  }

  try {
    return JSON.parse(text) as SignData;
  } catch (error) {
    throw new SignFileError(`${file} is not valid JSON; fix it before importing`, {
      cause: error,
    });
  }
}

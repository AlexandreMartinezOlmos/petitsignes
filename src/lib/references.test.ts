import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import commitlintConfig from '../../commitlint.config.js';

/**
 * Every explanation in this repository has to be readable by someone who only
 * has this repository.
 *
 * Comments and docs used to point at working notes that were never published —
 * a document named in a comment, or a bare "§4.1" that only resolved inside
 * one. To a contributor, or anyone auditing the code, those were dead ends: a
 * reason cited and then withheld. Each was rewritten to carry its reason in
 * place, and this file keeps it that way.
 *
 * The history is left as it happened. These rules apply to what the repository
 * says today, and to every commit from here on.
 */

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const tracked = new Set(files);
const trackedNames = new Set(files.map((file) => file.split('/').pop()));

/** Ignore files list untracked paths by definition: that is their job. */
const IGNORE_FILES = new Set(['.gitignore', '.prettierignore']);

/** Tracked text files, read once. Binary files (a NUL byte) are skipped. */
const texts: Array<{ file: string; text: string }> = files.flatMap((file) => {
  if (IGNORE_FILES.has(file)) return [];
  const bytes = readFileSync(file);
  return bytes.includes(0) ? [] : [{ file, text: bytes.toString('utf8') }];
});

/** 1-based line of an offset, so a failure points at the place to fix. */
const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

describe('what the repository cites, it contains', () => {
  it('reads a real number of files', () => {
    // Guards the guard: an empty file list would make every rule below pass.
    expect(texts.length).toBeGreaterThan(100);
  });

  /**
   * A document named in a comment or a doc has to be one a reader can open.
   * A path with a directory must resolve from the citing file or from the root;
   * a bare file name must match some tracked file.
   */
  it('names only Markdown documents that are in the repository', () => {
    const dangling: string[] = [];
    const markdownPath = /(?<![\w./-])((?:\.{1,2}\/)*[\w.-]+(?:\/[\w.-]+)*\.md)\b/g;

    for (const { file, text } of texts) {
      for (const match of text.matchAll(markdownPath)) {
        const ref = match[1] ?? '';
        // A link to another site is not a claim about this repository.
        if (/https?:\/\/\S*$/.test(text.slice(Math.max(0, match.index - 200), match.index))) {
          continue;
        }
        const found = ref.includes('/')
          ? tracked.has(normalize(join(dirname(file), ref))) || tracked.has(normalize(ref))
          : trackedNames.has(ref);
        if (!found) dangling.push(`${file}:${lineOf(text, match.index)} → ${ref}`);
      }
    }

    expect(dangling, 'cited documents that are not in the repository').toEqual([]);
  });

  /**
   * A section sign has to say whose section it is. Allowed: a WCAG success
   * criterion (`WCAG 2.2 §2.5.8`), a clause of the licence (`AGPL §13`), or —
   * inside a Markdown document — a numbered heading of that same document
   * (`§7` in a file with a `## 7.` heading).
   */
  it('qualifies every section sign with the document it belongs to', () => {
    const unqualified: string[] = [];

    for (const { file, text } of texts) {
      const ownSections = new Set(
        file.endsWith('.md')
          ? [...text.matchAll(/^#{2,6} (\d+(?:\.\d+)*)\.?\s/gm)].map((heading) => heading[1])
          : [],
      );

      for (const match of text.matchAll(/§\s?(\d+(?:\.\d+)*)/g)) {
        const before = text.slice(Math.max(0, match.index - 12), match.index);
        if (/(?:WCAG 2\.2|AGPL(?:'s)?) $/.test(before)) continue;
        if (ownSections.has(match[1])) continue;
        unqualified.push(`${file}:${lineOf(text, match.index)} → ${match[0]}`);
      }
    }

    expect(unqualified, 'section signs with no document a reader can find').toEqual([]);
  });
});

describe('commit messages', () => {
  type Rule = (commit: { raw: string }) => [boolean, string?];
  const rule = commitlintConfig.plugins[0]?.rules['co-authors-are-people'] as Rule;
  const check = (raw: string): boolean => rule({ raw })[0];

  it('is switched on as an error, not a warning', () => {
    expect(commitlintConfig.rules['co-authors-are-people']).toEqual([2, 'always']);
  });

  it('accepts a commit with no co-author, or with a person', () => {
    expect(check('fix: a thing\n\nBecause.')).toBe(true);
    expect(check('fix: a thing\n\nCo-authored-by: Ada Lovelace <ada@example.org>')).toBe(true);
    // GitHub's private address for a person is still a person.
    expect(check('fix: a thing\n\nCo-authored-by: Ada <1234+ada@users.noreply.github.com>')).toBe(
      true,
    );
  });

  it('refuses a co-author trailer that names a service account', () => {
    expect(check('fix: a thing\n\nCo-Authored-By: Some Tool <noreply@example.com>')).toBe(false);
    expect(check('fix: a thing\n\nco-authored-by: Some Tool <NoReply@example.com>')).toBe(false);
  });
});

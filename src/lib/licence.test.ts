import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The licensing files, checked as the bytes that ship.
 *
 * This suite exists because of a failure that was live for nine days without
 * anyone noticing. The repository carried a perfectly valid MIT licence with a
 * short project note appended after a `---` rule, and GitHub reported
 * `"spdx_id": "NOASSERTION"` — no badge, absent from licence-filtered search,
 * read as "no clear licence" by every automated scanner. GitHub's detector
 * (Licensee) matches a licence file against the canonical text and gives up
 * when the similarity drops; the note was enough to drop it.
 *
 * That was cosmetic under MIT. Under the AGPL it would be a hole in the point
 * of the licence: the deterrent only works on someone who can see it. So the
 * rule this file guards is narrow and absolute — LICENSE holds the verbatim
 * licence text and nothing else, and every project-specific note lives in
 * NOTICE instead.
 */
const read = (name: string) => readFileSync(resolve(process.cwd(), name), 'utf8');

const LICENSE = read('LICENSE');
const NOTICE = read('NOTICE');
const TRADEMARK = read('TRADEMARK.md');
const pkg = JSON.parse(read('package.json')) as { license?: string };

describe('LICENSE', () => {
  it('is the GNU AGPL v3', () => {
    expect(LICENSE).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
    expect(LICENSE).toContain('Version 3, 19 November 2007');
  });

  /**
   * The canonical text is a fixed document — the FSF has never revised AGPLv3 —
   * so pinning both ends is safe, and between them these are the two edges a
   * well-meaning edit actually touches: a project header pasted on top, or a
   * note appended at the bottom. Both are how the MIT file broke.
   */
  it('starts and ends exactly where the canonical text does', () => {
    expect(LICENSE.trimStart().startsWith('GNU AFFERO GENERAL PUBLIC LICENSE')).toBe(true);
    expect(LICENSE.trimEnd().endsWith('<https://www.gnu.org/licenses/>.')).toBe(true);
  });

  /**
   * The rule stated the way it will actually be broken. Someone adding "just a
   * line" about the videos to LICENSE is being helpful, and it is the one edit
   * that silently un-licenses the repository in GitHub's eyes.
   */
  it('carries no project-specific note — those belong in NOTICE', () => {
    for (const term of ['Petits Signes', 'petitsignes', 'DILSE', 'CC BY-SA', 'CNSE']) {
      expect(
        LICENSE.includes(term),
        `LICENSE must stay the verbatim AGPL text so GitHub can detect it; ` +
          `"${term}" belongs in NOTICE. See the NOASSERTION incident in this file's header.`,
      ).toBe(false);
    }
  });
});

describe('the declared licence agrees with itself', () => {
  // Three files state the licence and a fourth is read by tooling. Divergence
  // here is the kind that surfaces in someone else's SBOM, not in review.
  it('matches between package.json, LICENSE and NOTICE', () => {
    expect(pkg.license).toBe('AGPL-3.0-or-later');
    expect(NOTICE).toContain('GNU Affero General Public License v3.0 or later');
  });

  it('names a single copyright holder who can actually enforce it', () => {
    // "Petits Signes contributors" was the previous holder line. Only the
    // rights holder can enforce a copyleft licence, so a collective placeholder
    // with no legal person behind it makes the AGPL decorative.
    expect(NOTICE).toContain('Copyright (C) 2026 Alexandre Martínez Olmos');
    expect(NOTICE).not.toContain('Petits Signes contributors');
  });
});

describe('NOTICE', () => {
  // The three-way split is the whole point of the file: the AGPL covers the
  // code only, and a reader who assumes it reaches the videos would conclude
  // they may redistribute material this project has no right to license.
  it('separates code, curated data and the third-party videos', () => {
    expect(NOTICE).toContain('CC BY-SA 4.0');
    expect(NOTICE).toContain('NOT COVERED BY EITHER LICENCE ABOVE');
    expect(NOTICE).toMatch(/Generalitat de Catalunya/);
    expect(NOTICE).toMatch(/Fundación CNSE/);
  });

  // §13 is satisfied by the footer link on every page, so the obligation is
  // recorded next to the licence rather than living only in a commit message.
  it('records why the footer source link is a licence obligation', () => {
    expect(NOTICE).toContain('Section 13');
    expect(NOTICE).toContain('github.com/AlexandreMartinezOlmos/petitsignes');
  });
});

describe('TRADEMARK.md', () => {
  it('reserves the name the AGPL does not cover', () => {
    expect(TRADEMARK).toContain('Petits Signes');
    expect(TRADEMARK).toContain('petitsignes.cat');
  });

  /**
   * The mark is unregistered and there is no plan to register it. `®` asserts a
   * registration; using it without one is itself a false claim, and a brand
   * policy that overstates its footing is worth less than none.
   */
  it('claims no registration it does not have', () => {
    expect(TRADEMARK).not.toContain('®');
    expect(TRADEMARK).toContain('not registered');
  });
});

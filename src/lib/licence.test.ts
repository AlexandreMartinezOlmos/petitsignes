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

describe('THIRD-PARTY-NOTICES.md', () => {
  const THIRD_PARTY = read('THIRD-PARTY-NOTICES.md');

  /**
   * The obligation this file discharges is easy to miss because nothing breaks
   * when it is missed. React, Nano Stores and Fuse.js end up inside the bundle
   * browsers download, and Nunito Sans is served as .woff2 from this origin —
   * both MIT and the SIL Open Font Licence ask their notice to travel with the
   * copy, and the minifier strips every comment, so the bundle cannot carry
   * them. Without this file the site redistributes their code with the
   * attribution deleted.
   */
  it('names every dependency whose code reaches a browser', () => {
    for (const dep of ['react', 'nanostores', 'fuse.js', 'nunito-sans']) {
      expect(THIRD_PARTY.toLowerCase()).toContain(dep);
    }
  });

  // Copied from each package's own LICENSE, not written from memory: an
  // attribution to the wrong person is worse than an absent one.
  it('carries the actual copyright lines, not a summary', () => {
    expect(THIRD_PARTY).toContain('Copyright (c) Meta Platforms, Inc. and affiliates.');
    expect(THIRD_PARTY).toContain('Andrey Sitnik');
    expect(THIRD_PARTY).toContain('Kiro Risk');
    expect(THIRD_PARTY).toContain('The Nunito Sans Project Authors');
  });

  // MIT asks for its permission notice verbatim, so a link to it is not enough.
  it('reproduces the MIT text the notices require', () => {
    expect(THIRD_PARTY).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(THIRD_PARTY).toContain('Apache');
    expect(THIRD_PARTY).toContain('SIL Open Font License');
  });

  it('is reachable from NOTICE, which is the map', () => {
    expect(NOTICE).toContain('THIRD-PARTY-NOTICES.md');
  });
});

describe('TRADEMARK.md', () => {
  it('reserves the name the AGPL does not cover', () => {
    expect(TRADEMARK).toContain('Petits Signes');
    expect(TRADEMARK).toContain('petitsignes.cat');
  });

  // ® asserts a registration this project does not have; claiming one that
  // does not exist is a false claim regardless of how it got there.
  it('never claims a registration it does not have', () => {
    expect(TRADEMARK).not.toContain('®');
  });
});

/**
 * No public document explains the private reasoning behind a legal position.
 *
 * TRADEMARK.md briefly carried a section titled "Honest note on legal
 * standing": it stated, in public, that the mark was unregistered as a
 * "budget-driven decision", then walked through exactly which enforcement
 * option was unavailable and named the one that remained "narrower and
 * harder to invoke". None of that was a licence obligation or a fact a
 * reader needed. It was a map of the weakest point in the project's legal
 * position, handed to anyone who might want to use it — the kind of thing
 * said once in conversation while deciding what to do, never meant to ship.
 *
 * A public policy document states the rule and what it asks of a reader. It
 * does not explain why the owner can or cannot afford to enforce it, and it
 * does not rank the owner's own remedies from strong to weak. That line holds
 * regardless of how true or well-argued the reasoning is — true and private
 * is not the same as safe to publish.
 *
 * LICENSE and THIRD-PARTY-NOTICES.md are excluded: both are canonical
 * third-party licence text quoted verbatim (the AGPL and the MIT/Apache
 * notices legitimately use words like "infringement"), and LICENSE is
 * already held to a stricter rule above — no prose of any kind.
 */
describe('public documents never explain private legal or financial reasoning', () => {
  const OWN_PROSE: Record<string, string> = {
    'TRADEMARK.md': TRADEMARK,
    NOTICE,
    'README.md': read('README.md'),
    'CONTRIBUTING.md': read('CONTRIBUTING.md'),
  };

  // Specific phrases, not bare words: a single word like "weak" or
  // "afford" shows up honestly in unrelated technical prose (contrast
  // ratios, Lighthouse budgets), and a guardrail that fires on those trains
  // everyone to ignore it. Multi-word phrases are what the incident actually
  // looked like, in English and in the Spanish this project also writes in.
  const REDACT_ON_SIGHT = [
    'budget-driven',
    'budget driven',
    "can't afford",
    'cannot afford',
    'no plan to register',
    'no current plan to register',
    'narrower and harder',
    'harder to invoke',
    'didn\'t know" defence',
    'no trademark infringement action',
    'legal standing',
    'no quiero gastar',
    'no queremos gastar',
    'decisión de presupuesto',
    'presupuesto ajustado',
  ];

  for (const [file, text] of Object.entries(OWN_PROSE)) {
    it(`${file} carries none of the phrasing from that incident`, () => {
      const lower = text.toLowerCase();
      for (const phrase of REDACT_ON_SIGHT) {
        expect(
          lower.includes(phrase),
          `${file} contains "${phrase}" — this is how the trademark ` +
            `weakness leak read. State the rule, not the reasoning behind ` +
            `whether or how it can be enforced.`,
        ).toBe(false);
      }
    });
  }
});

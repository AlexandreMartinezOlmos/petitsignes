/**
 * A `Co-authored-by` trailer credits a person who can answer for the change.
 * Service accounts write from a bare `noreply@` address, and a trailer naming
 * one is refused. GitHub's private address for a person
 * (`1234+name@users.noreply.github.com`) does not start with `noreply@`, so a
 * human co-author always passes.
 *
 * @param {{ raw?: string }} commit
 * @returns {[boolean, string]}
 */
function coAuthorsArePeople({ raw = '' }) {
  const offending = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^co-authored-by:.*<noreply@/i.test(line));
  return [
    offending.length === 0,
    `a co-author trailer must name a person, not a service account: ${offending.join('; ')}`,
  ];
}

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [{ rules: { 'co-authors-are-people': coAuthorsArePeople } }],
  rules: {
    'co-authors-are-people': [2, 'always'],
    // `content` covers sign data changes, which are reviewed like code.
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        'content',
      ],
    ],
  },
};

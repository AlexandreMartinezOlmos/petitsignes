export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // `content` covers sign data changes, which are reviewed like code (§9).
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

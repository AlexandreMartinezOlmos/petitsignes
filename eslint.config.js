import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig([
  globalIgnores([
    'dist/',
    '.astro/',
    'node_modules/',
    'coverage/',
    'playwright-report/',
    'test-results/',
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,

  // Accessibility linting for both Astro templates and React islands. Registered
  // once here rather than via astro's jsx-a11y preset, because two configs
  // cannot both define the same plugin.
  {
    files: ['**/*.{jsx,tsx,astro}'],
    extends: [jsxA11y.flatConfigs.recommended],
  },

  {
    files: ['**/*.{jsx,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
  },

  {
    files: ['**/*.{ts,tsx,astro}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // `any` needs an explicit justification.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Build/tooling config files run in Node.
  {
    files: ['*.config.{js,mjs,ts}', 'commitlint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Content scripts run in Node and legitimately log progress.
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },

  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Must stay last: turns off everything Prettier already handles.
  prettier,
]);

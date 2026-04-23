import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/._*', '**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'max-lines': [
        'error',
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [],
          patterns: [
            {
              group: ['packages/agents/*/*/../*'],
              message: 'Cross-agent imports are forbidden. Agents communicate via shared signal records only.',
            },
            {
              group: ['*/agents/orchestrator/*'],
              message: 'Agents must not import orchestrator internals. Use the interface types from @flow/agents instead.',
            },
            {
              group: ['*/agents/shared/*'],
              importNames: ['default'],
              message: 'Shared utilities must not import from agent modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      'max-lines': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);

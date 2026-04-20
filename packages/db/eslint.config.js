import baseConfig from '@flow/config/eslint.config.base.js';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@flow/db',
              message: 'Do not import createServiceClient from @flow/db barrel. Use: import { createServiceClient } from "@flow/db/client"',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
];

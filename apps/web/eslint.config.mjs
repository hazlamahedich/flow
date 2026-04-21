import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: ['**/._*', '.next/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@flow/db/client'],
              message:
                'service_role client is only allowed in packages/auth/server-admin.ts. Use createServerClient from @flow/db instead.',
              allowTypeImports: false,
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;

import baseConfig from '@flow/eslint-config';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];

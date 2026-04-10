import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from '@typescript-eslint/eslint-plugin';

export default [
  ...nextCoreWebVitals,
  ...tseslint.configs['flat/recommended'],
  {
    ignores: ['node_modules/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },
];

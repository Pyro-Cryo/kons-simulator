import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import markdown from '@eslint/markdown';
import css from '@eslint/css';
import {defineConfig} from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: {js},
    extends: ['js/recommended'],
    languageOptions: {globals: globals.browser},
    rules: {
      semi: ['warn', 'always'],
      'max-len': [
        'warn',
        {
          code: 80,
          tabWidth: 2,
          comments: 80,
          ignoreUrls: true,
          ignoreRegExpLiterals: true,
        },
      ],
      indent: ['warn', 2, {SwitchCase: 1}],
      "@typescript-eslint/no-unused-vars": [
        'warn',
        {
          // Tillåt _ som namn på oanvända variabler.
          argsIgnorePattern: '^_$',
          varsIgnorePattern: '^_$'
        },
      ],
    },
  },
  tseslint.configs.recommended,
  {
    files: ['**/*.md'],
    plugins: {markdown},
    language: 'markdown/gfm',
    extends: ['markdown/recommended'],
  },
  {
    files: ['**/*.css'],
    plugins: {css},
    language: 'css/css',
    extends: ['css/recommended'],
  },
]);

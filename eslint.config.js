import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import astroPlugin from 'eslint-plugin-astro';
import astroParser from 'astro-eslint-parser';
import globals from 'globals';

export default [
  // Base JavaScript recommended config
  js.configs.recommended,

  // TypeScript configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json', // Explicit path to tsconfig.json
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
      'react/prop-types': 'off', // TypeScript provides type checking
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/triple-slash-reference': 'off', // Allow triple-slash references for Cloudflare Workers types
    },
  },
  // Astro configuration
  {
    files: ['**/*.astro'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: astroParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.astro'],
      },
    },
    plugins: {
      'astro': astroPlugin,
    },
    rules: {
      ...astroPlugin.configs.recommended.rules,
      ...astroPlugin.configs['jsx-a11y-recommended'].rules,
      'react/no-unknown-property': 'off', // Allow Astro-specific attributes
    },
  },
  // Worker-specific configuration to avoid LSP conflicts
  {
    files: ['src/worker.ts'],
    languageOptions: {
      globals: {
        // Explicitly declare Cloudflare Worker globals
        ExecutionContext: 'readonly',
        ExportedHandler: 'readonly',
        Env: 'readonly',
      },
    },
  },
  // General ignore patterns
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.astro/**',
      'public/**',
      'wrangler.jsonc',
      'worker-configuration.d.ts',
      '.wrangler/**',
      '.dev.vars'
    ],
  },
];
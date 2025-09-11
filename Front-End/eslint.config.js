// @ts-check
import js from '@eslint/js';
import reactRefresh from 'eslint-plugin-react-refresh';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // ignore build output
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-refresh': reactRefresh
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  // browser env for frontend files
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        URL: 'readonly',
        Path2D: 'readonly',
        MutationObserver: 'readonly',
        MessageChannel: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        queueMicrotask: 'readonly',
        atob: 'readonly',
        performance: 'readonly',
        AbortController: 'readonly',
        Blob: 'readonly',
        FileList: 'readonly',
        Intl: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly'
      }
    }
  },
  // vitest env for tests
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly'
      }
    }
  }
];

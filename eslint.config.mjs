// eslint.config.mjs
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import pluginJest from 'eslint-plugin-jest';
import globals from 'globals';

export default defineConfig([
  // 1. Ignores
  // Replaces 'ignorePatterns'
  // node_modules is ignored by default.
  // tseslint.config adds reasonable defaults for JS files when using type-checking.
  {
    ignores: [
      'dist/',
      'lib/',
      '*.js' // From your old config. Be careful this doesn't ignore JS files you *want* to lint.
    ]
  },

  // 2. Global Language Options
  // Replaces 'env' and global 'parserOptions'
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
        // 'jest: true' is handled by the Jest plugin config below
      }
    }
  },

  // 3. Base ESLint rules
  // Replaces 'extends: "eslint:recommended"'
  js.configs.recommended,

  // 4. TypeScript Rules
  // This one spread replaces:
  // - 'parser: "@typescript-eslint/parser"'
  // - 'plugins: ["@typescript-eslint"]'
  // - 'extends: "plugin:@typescript-eslint/recommended"'
  // - 'extends: "plugin:@typescript-eslint/recommended-requiring-type-checking"'
  ...tseslint.configs.recommendedTypeChecked,

  // 5. TypeScript Parser Options
  // This object merges with the above, providing the project path.
  // Replaces 'parserOptions: { project: ... }'
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json'
      }
    }
  },

  // 6. Jest Config (Scoped to test files)
  // Replaces 'plugins: ["jest"]', 'extends: "plugin:jest/recommended"', and 'env: { jest: true }'
  {
    // Apply this config only to test files
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
    // Use the 'flat' recommended config from jest
    ...pluginJest.configs['flat/recommended']
    // You could add Jest-specific rule overrides here if needed
  },

  // 7. Custom Rule Overrides (Must go last)
  // Replaces your top-level 'rules' object
  {
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true
        }
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_.',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
]);

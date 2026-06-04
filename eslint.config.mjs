// Minimal flat ESLint config (RT-3). typescript-eslint *recommended* (not the
// type-checked variant) — fast, no typed-linting project wiring, and it
// disables core `no-undef` (TS already proves bindings), so Workers/ambient
// globals (Request, Response, ExecutionContext, crypto, …) don't false-positive.
//
// Scope is the hand-written TypeScript under packages/*/src and test. Generated
// and built artifacts are ignored: dist/, .d.ts (incl. worker-configuration.d.ts),
// .wrangler/, node_modules/.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/.wrangler/**',
      'migrations/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Honor the `_`-prefix convention the codebase already uses to mark
      // intentionally-unused bindings (args, vars, caught errors).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Tests pragmatically use `any` for fixtures and JSON-RPC parsing.
    files: ['**/*.test.ts', '**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);

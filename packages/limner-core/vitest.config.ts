import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Integration tests (real upstream API calls) live in *.integration.test.ts
    // files and are excluded from the default run. Run them via
    // `pnpm test:integration` (separate config), with the required API keys
    // in env. See packages/limner-core/README.md for details.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    // miniflare may need a moment to spin up workerd for D1 emulation;
    // default 5s is too tight in cold-start scenarios.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

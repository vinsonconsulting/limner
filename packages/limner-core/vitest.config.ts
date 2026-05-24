import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // miniflare may need a moment to spin up workerd for D1 emulation;
    // default 5s is too tight in cold-start scenarios.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

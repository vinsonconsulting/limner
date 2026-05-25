import { defineConfig } from 'vitest/config';

// Integration tests for API-backed pipelines. Excluded from the default
// `pnpm test` run; opt in via `pnpm test:integration`. Each test
// describes.skipIf() its own required env var so an empty environment
// produces a clean skip rather than a failure.
//
// Pipelines and their env keys:
//   dalle           - OPENAI_API_KEY
//   recraft (remote) - RECRAFT_API_KEY  (also needs the Phase 4 MCP transport
//                                        wiring to actually exercise)
// (RetroDiffusion moved to limner-pixel per D-RA-18.)

export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    // Real API calls — generous timeout per test, generous hook for setup.
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // Don't bail on first failure; we want to see all integration results.
    bail: 0,
  },
});

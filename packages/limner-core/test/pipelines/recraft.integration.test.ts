import { describe, test } from 'vitest';

// D-RA-25: Recraft is a direct REST pipeline (RestRecraftTransport lives in
// @limner/core), so live coverage can run from this package — no dependency
// cycle. Kept as a todo so the default suite never makes a paid Recraft call;
// flesh out under the integration config with a real key when needed:
//
//   import { RecraftPipeline, RestRecraftTransport, type PipelineImageOutput }
//     from '../../src/index.js';
//
//   const apiKey = process.env['RECRAFT_API_KEY'];
//   describe.skipIf(!apiKey)('RecraftPipeline — integration (requires RECRAFT_API_KEY)', () => {
//     test('generates an image via external.api.recraft.ai', async () => {
//       const p = new RecraftPipeline(new RestRecraftTransport(apiKey!));
//       const out = (await p.generate({ prompt: 'a fox logo' },
//         { secrets: { RECRAFT_API_KEY: apiKey! } })) as PipelineImageOutput;
//       // assertions on out.url / out.data ...
//     }, 120_000);
//   });

describe.todo('RecraftPipeline — REST integration', () => {
  test.todo('generates an image via external.api.recraft.ai (requires RECRAFT_API_KEY)');
});

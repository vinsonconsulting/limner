import { describe, expect, test } from 'vitest';

import { DallePipeline, type PipelineImageOutput } from '../../src/index.js';

const apiKey = process.env['OPENAI_API_KEY'];

// Skip the entire suite when the key is absent so the file can sit in the
// tree without polluting `pnpm test:integration` output for users who don't
// have the key configured.
describe.skipIf(!apiKey)('DallePipeline — integration (requires OPENAI_API_KEY)', () => {
  test('generates an image at the default size', { timeout: 90_000 }, async () => {
    const p = new DallePipeline();
    const out = (await p.generate(
      {
        prompt: 'a single red apple on a plain white background, photorealistic',
        options: { size: '1024x1024', quality: 'standard' },
      },
      { secrets: { OPENAI_API_KEY: apiKey! } },
    )) as PipelineImageOutput;

    expect(out.kind).toBe('image');
    expect(out.mimeType).toBe('image/png');
    // url is the default response_format; should be a real-looking URL.
    expect(out.url).toMatch(/^https:\/\//);
    expect(out.width).toBe(1024);
    expect(out.height).toBe(1024);
    expect(out.metadata).toMatchObject({ pipeline: 'dalle', model: 'dall-e-3' });
  });
});

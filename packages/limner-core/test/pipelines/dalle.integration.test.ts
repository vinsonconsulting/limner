import { describe, expect, test } from 'vitest';

import { DallePipeline, type PipelineImageOutput } from '../../src/index.js';

const apiKey = process.env['OPENAI_API_KEY'];

// Skip the entire suite when the key is absent so the file can sit in the
// tree without polluting `pnpm test:integration` output for users who don't
// have the key configured.
describe.skipIf(!apiKey)('DallePipeline — integration (requires OPENAI_API_KEY)', () => {
  test('generates an image with default model (gpt-image-1)', { timeout: 120_000 }, async () => {
    const p = new DallePipeline();
    // Minimal request: model defaults to gpt-image-1, size to 1024x1024.
    // No quality / outputFormat / background — let OpenAI's server-side
    // defaults win; fewer parameters means fewer reasons to fail when
    // OpenAI updates the API surface again.
    const out = (await p.generate(
      { prompt: 'a single red apple on a plain white background, photorealistic' },
      { secrets: { OPENAI_API_KEY: apiKey! } },
    )) as PipelineImageOutput;

    expect(out.kind).toBe('image');
    expect(out.mimeType).toBe('image/png');
    // gpt-image-1 always returns b64_json (no url). The pipeline decodes
    // to Uint8Array via the auto-detect response branch.
    expect(out.url).toBeUndefined();
    expect(out.data).toBeInstanceOf(Uint8Array);
    expect(out.data!.length).toBeGreaterThan(0);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(out.data!.slice(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(out.width).toBe(1024);
    expect(out.height).toBe(1024);
    expect(out.metadata).toMatchObject({ pipeline: 'dalle', model: 'gpt-image-1' });
  });
});

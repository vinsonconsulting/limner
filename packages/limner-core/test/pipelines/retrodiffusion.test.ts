import { describe, expect, test, vi } from 'vitest';

import {
  PipelineError,
  RetroDiffusionPipeline,
  type PipelineContext,
  type PipelineImageOutput,
} from '../../src/index.js';

function mockFetch(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

const SECRETS = { RETRODIFFUSION_API_KEY: 'rd-test-456' };
const ctx: PipelineContext = { secrets: SECRETS };

// 1x1 red pixel PNG, base64-encoded.
const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';

describe('RetroDiffusionPipeline — metadata', () => {
  test('id / kind / requiredSecrets', () => {
    const p = new RetroDiffusionPipeline();
    expect(p.id).toBe('retrodiffusion');
    expect(p.kind).toBe('api');
    expect(p.requiredSecrets).toEqual(['RETRODIFFUSION_API_KEY']);
  });
});

describe('RetroDiffusionPipeline — missing credential', () => {
  test('throws missing_credential when key absent', async () => {
    const p = new RetroDiffusionPipeline(mockFetch(new Response('{}', { status: 200 })));
    await expect(p.generate({ prompt: 'cat' }, { secrets: {} })).rejects.toMatchObject({
      code: 'missing_credential',
    });
  });
});

describe('RetroDiffusionPipeline — happy path', () => {
  test('returns image with bytes and metadata', async () => {
    const fetchMock = mockFetch(
      new Response(
        JSON.stringify({
          credit_cost: 1,
          remaining_credits: 199,
          base64_images: [ONE_PIXEL_PNG],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const p = new RetroDiffusionPipeline(fetchMock);
    const out = (await p.generate({ prompt: 'pixel art cat' }, ctx)) as PipelineImageOutput;

    expect(out.kind).toBe('image');
    expect(out.data).toBeInstanceOf(Uint8Array);
    expect(out.data!.slice(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(out.width).toBe(256);
    expect(out.height).toBe(256);
    expect(out.mimeType).toBe('image/png');
    expect(out.metadata).toMatchObject({
      pipeline: 'retrodiffusion',
      promptStyle: 'rd_fast__default',
      numImages: 1,
      creditCost: 1,
      remainingCredits: 199,
    });
  });

  test('passes width/height/seed/options to body', async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ base64_images: [ONE_PIXEL_PNG] }), { status: 200 }),
    );
    const p = new RetroDiffusionPipeline(fetchMock);
    await p.generate(
      {
        prompt: 'sprite',
        width: 64,
        height: 64,
        seed: 12345,
        options: { promptStyle: 'rd_plus__game_asset', numImages: 2 },
      },
      ctx,
    );
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const headers = (call[1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-RD-Token']).toBe('rd-test-456');
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      prompt: 'sprite',
      width: 64,
      height: 64,
      seed: 12345,
      prompt_style: 'rd_plus__game_asset',
      num_images: 2,
    });
  });

  test('omits seed when not provided', async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ base64_images: [ONE_PIXEL_PNG] }), { status: 200 }),
    );
    const p = new RetroDiffusionPipeline(fetchMock);
    await p.generate({ prompt: 'cat' }, ctx);
    const body = JSON.parse(
      ((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.seed).toBeUndefined();
  });
});

describe('RetroDiffusionPipeline — upstream errors', () => {
  test('401 → unauthorized', async () => {
    const p = new RetroDiffusionPipeline(mockFetch(new Response('bad', { status: 401 })));
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  test('429 → rate_limited', async () => {
    const p = new RetroDiffusionPipeline(mockFetch(new Response('slow', { status: 429 })));
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  test('502 → upstream_unavailable', async () => {
    const p = new RetroDiffusionPipeline(mockFetch(new Response('down', { status: 502 })));
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'upstream_unavailable',
    });
  });

  test('empty base64_images → upstream_error', async () => {
    const p = new RetroDiffusionPipeline(
      mockFetch(new Response(JSON.stringify({ base64_images: [] }), { status: 200 })),
    );
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'upstream_error',
    });
  });

  test('PipelineError carries pipelineId', async () => {
    const p = new RetroDiffusionPipeline(mockFetch(new Response('x', { status: 401 })));
    try {
      await p.generate({ prompt: 'cat' }, ctx);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError);
      expect((err as PipelineError).pipelineId).toBe('retrodiffusion');
    }
  });
});

describe('RetroDiffusionPipeline — invalid input', () => {
  test('empty prompt throws invalid_input', async () => {
    const p = new RetroDiffusionPipeline(mockFetch(new Response('{}', { status: 200 })));
    await expect(p.generate({ prompt: '' }, ctx)).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });
});

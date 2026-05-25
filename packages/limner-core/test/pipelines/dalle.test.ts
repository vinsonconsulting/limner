import { describe, expect, test, vi } from 'vitest';

import {
  DallePipeline,
  PipelineError,
  type PipelineContext,
  type PipelineGenerateInput,
  type PipelineImageOutput,
} from '../../src/index.js';

// Builds a typed mock fetch that returns the given Response without
// touching the global fetch. Vitest's vi.fn keeps spy assertions clean.
function mockFetch(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

function mockFetchThrowing(err: unknown): typeof fetch {
  return vi.fn().mockRejectedValue(err) as unknown as typeof fetch;
}

const SECRETS = { OPENAI_API_KEY: 'sk-test-123' };
const ctx: PipelineContext = { secrets: SECRETS };

describe('DallePipeline — metadata', () => {
  test('id / displayName / kind / requiredSecrets', () => {
    const p = new DallePipeline();
    expect(p.id).toBe('dalle');
    expect(p.kind).toBe('api');
    expect(p.requiredSecrets).toEqual(['OPENAI_API_KEY']);
  });
});

describe('DallePipeline — missing credential', () => {
  test('throws missing_credential when OPENAI_API_KEY absent', async () => {
    const p = new DallePipeline(mockFetch(new Response('{}', { status: 200 })));
    const input: PipelineGenerateInput = { prompt: 'cat' };
    await expect(p.generate(input, { secrets: {} })).rejects.toMatchObject({
      pipelineId: 'dalle',
      code: 'missing_credential',
    });
  });
});

describe('DallePipeline — happy path', () => {
  test('returns image with url when response_format is url (default)', async () => {
    const fetchMock = mockFetch(
      new Response(
        JSON.stringify({
          created: 1,
          data: [{ url: 'https://cdn.openai.com/img.png', revised_prompt: 'a beautiful cat' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const p = new DallePipeline(fetchMock);
    const out = (await p.generate({ prompt: 'cat' }, ctx)) as PipelineImageOutput;

    expect(out.kind).toBe('image');
    expect(out.url).toBe('https://cdn.openai.com/img.png');
    expect(out.mimeType).toBe('image/png');
    expect(out.width).toBe(1024);
    expect(out.height).toBe(1024);
    expect(out.metadata).toMatchObject({
      pipeline: 'dalle',
      model: 'dall-e-3',
      revisedPrompt: 'a beautiful cat',
    });

    // Verify the request was shaped correctly.
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [url, init] = call;
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test-123');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      model: 'dall-e-3',
      prompt: 'cat',
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
    });
    // response_format was deprecated in OpenAI's 2025/2026 Images API
    // consolidation; the pipeline must NOT send it.
    expect(body).not.toHaveProperty('response_format');
  });

  test('decodes b64_json response when upstream returns bytes (e.g. gpt-image-1)', async () => {
    // 1x1 red pixel PNG, base64-encoded.
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const fetchMock = mockFetch(
      new Response(
        // No `url` field; only b64_json. Pipeline auto-detects shape.
        JSON.stringify({ created: 1, data: [{ b64_json: onePixelPng }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const p = new DallePipeline(fetchMock);
    const out = (await p.generate({ prompt: 'cat' }, ctx)) as PipelineImageOutput;

    expect(out.url).toBeUndefined();
    expect(out.data).toBeInstanceOf(Uint8Array);
    expect(out.data!.length).toBeGreaterThan(0);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(out.data!.slice(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  test('honors model / size / quality / style options', async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ url: 'https://x' }] }), { status: 200 }),
    );
    const p = new DallePipeline(fetchMock);
    await p.generate(
      {
        prompt: 'cat',
        options: { model: 'dall-e-3', size: '1792x1024', quality: 'hd', style: 'natural' },
      },
      ctx,
    );
    const body = JSON.parse(
      ((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({ size: '1792x1024', quality: 'hd', style: 'natural' });
  });

  test('omits quality/style for dall-e-2', async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ url: 'https://x' }] }), { status: 200 }),
    );
    const p = new DallePipeline(fetchMock);
    await p.generate({ prompt: 'cat', options: { model: 'dall-e-2', size: '512x512' } }, ctx);
    const body = JSON.parse(
      ((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.quality).toBeUndefined();
    expect(body.style).toBeUndefined();
  });
});

describe('DallePipeline — invalid input', () => {
  test('empty prompt throws invalid_input', async () => {
    const p = new DallePipeline(mockFetch(new Response('{}', { status: 200 })));
    await expect(p.generate({ prompt: '   ' }, ctx)).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });
});

describe('DallePipeline — upstream errors', () => {
  test('401 maps to unauthorized', async () => {
    const p = new DallePipeline(
      mockFetch(new Response('Invalid API key', { status: 401 })),
    );
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  test('429 maps to rate_limited', async () => {
    const p = new DallePipeline(mockFetch(new Response('Slow down', { status: 429 })));
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  test('400 maps to upstream_error', async () => {
    const p = new DallePipeline(mockFetch(new Response('Bad request', { status: 400 })));
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'upstream_error',
    });
  });

  test('503 maps to upstream_unavailable', async () => {
    const p = new DallePipeline(mockFetch(new Response('Down', { status: 503 })));
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'upstream_unavailable',
    });
  });

  test('network error becomes upstream_unavailable', async () => {
    const p = new DallePipeline(mockFetchThrowing(new TypeError('fetch failed')));
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'upstream_unavailable',
    });
  });

  test('abort signal becomes aborted', async () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    const p = new DallePipeline(mockFetchThrowing(abortErr));
    const ac = new AbortController();
    ac.abort();
    await expect(p.generate({ prompt: 'cat' }, { ...ctx, abortSignal: ac.signal })).rejects.toMatchObject({
      code: 'aborted',
    });
  });

  test('200 with malformed body throws upstream_error', async () => {
    const p = new DallePipeline(
      mockFetch(new Response(JSON.stringify({ data: [] }), { status: 200 })),
    );
    await expect(p.generate({ prompt: 'cat' }, ctx)).rejects.toMatchObject({
      code: 'upstream_error',
    });
  });
});

describe('DallePipeline — PipelineError structure', () => {
  test('thrown errors carry pipelineId', async () => {
    const p = new DallePipeline(mockFetch(new Response('nope', { status: 401 })));
    try {
      await p.generate({ prompt: 'cat' }, ctx);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError);
      expect((err as PipelineError).pipelineId).toBe('dalle');
    }
  });
});

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
      model: 'gpt-image-1',
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
      model: 'gpt-image-1',
      prompt: 'cat',
      n: 1,
      size: '1024x1024',
    });
    // OpenAI's 2025/2026 Images API consolidation removed these legacy
    // parameters from the request surface. The pipeline must NOT send them.
    expect(body).not.toHaveProperty('response_format');
    expect(body).not.toHaveProperty('style');
    expect(body).not.toHaveProperty('quality'); // not sent unless explicitly set in options
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

  test('gpt-image-1 honors quality / outputFormat / background when set', async () => {
    const fetchMock = mockFetch(
      new Response(
        JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgo=' }] }),
        { status: 200 },
      ),
    );
    const p = new DallePipeline(fetchMock);
    await p.generate(
      {
        prompt: 'cat',
        options: {
          model: 'gpt-image-1',
          size: '1024x1536',
          quality: 'high',
          outputFormat: 'webp',
          background: 'transparent',
        },
      },
      ctx,
    );
    const body = JSON.parse(
      ((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({
      model: 'gpt-image-1',
      size: '1024x1536',
      quality: 'high',
      output_format: 'webp',
      background: 'transparent',
    });
  });

  test('dall-e-3 sends only model / prompt / n / size (legacy params stripped)', async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ url: 'https://x' }] }), { status: 200 }),
    );
    const p = new DallePipeline(fetchMock);
    // Caller may still pass quality / style for compat — pipeline must not
    // forward them since OpenAI's API rejects them on dall-e-3 in 2025/2026.
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
    expect(body).toMatchObject({ model: 'dall-e-3', size: '1792x1024' });
    expect(body).not.toHaveProperty('quality');
    expect(body).not.toHaveProperty('style');
    expect(body).not.toHaveProperty('response_format');
  });

  test('dall-e-2 sends only model / prompt / n / size', async () => {
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
    expect(body.output_format).toBeUndefined();
    expect(body.background).toBeUndefined();
  });

  test('outputFormat: jpeg drives image/jpeg mime type', async () => {
    const fetchMock = mockFetch(
      new Response(
        JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgo=' }] }),
        { status: 200 },
      ),
    );
    const p = new DallePipeline(fetchMock);
    const out = (await p.generate(
      { prompt: 'cat', options: { outputFormat: 'jpeg' } },
      ctx,
    )) as PipelineImageOutput;
    expect(out.mimeType).toBe('image/jpeg');
  });

  test("size: 'auto' surfaces width/height as undefined", async () => {
    const fetchMock = mockFetch(
      new Response(
        JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgo=' }] }),
        { status: 200 },
      ),
    );
    const p = new DallePipeline(fetchMock);
    const out = (await p.generate(
      { prompt: 'cat', options: { size: 'auto' } },
      ctx,
    )) as PipelineImageOutput;
    expect(out.width).toBeUndefined();
    expect(out.height).toBeUndefined();
  });
});

describe('DallePipeline — Workers receiver binding (regression)', () => {
  // The Cloudflare Workers runtime rejects a *detached* global `fetch` with
  // "Illegal invocation: function called with incorrect `this` reference."
  // Node/undici tolerates the unbound call, which hid this defect from every
  // mock-fetch test above until the live Test-4 dogfood. This test drives the
  // pipeline through its DEFAULT constructor (the path the prod Worker uses)
  // against a `this`-sensitive global fetch that mimics the Workers semantics.
  test('default fetch is invoked without losing its receiver', async () => {
    const realFetch = globalThis.fetch;
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    function pickyFetch(this: unknown, _url: unknown, _init?: unknown): Promise<Response> {
      // Workers throws when `fetch` is called with a receiver other than the
      // global object (i.e. as a detached method).
      if (this !== undefined && this !== globalThis) {
        throw new TypeError(
          'Illegal invocation: function called with incorrect `this` reference.',
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: [{ b64_json: onePixelPng }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    globalThis.fetch = pickyFetch as unknown as typeof fetch;
    try {
      const p = new DallePipeline(); // DEFAULT fetchImpl — the prod Worker path
      const out = (await p.generate({ prompt: 'cat' }, ctx)) as PipelineImageOutput;
      expect(out.kind).toBe('image');
      expect(out.data).toBeInstanceOf(Uint8Array);
    } finally {
      globalThis.fetch = realFetch;
    }
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

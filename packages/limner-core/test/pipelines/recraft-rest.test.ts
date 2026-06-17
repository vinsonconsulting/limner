import { describe, expect, test, vi } from 'vitest';

import { RestRecraftTransport, type RecraftGenerateArgs } from '../../src/index.js';

function mockFetch(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

const ARGS: RecraftGenerateArgs = {
  prompt: 'a fox logo',
  size: '1024x1024',
  style: 'vector_illustration',
  substyle: 'flat',
  model: 'recraftv3',
};

describe('RestRecraftTransport — request shaping', () => {
  test('POSTs to external.api.recraft.ai with Bearer auth and JSON body', async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ url: 'https://img.recraft.ai/x.png' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const t = new RestRecraftTransport('rk-test-1', fetchMock);
    const out = await t.generateImage(ARGS);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://external.api.recraft.ai/v1/images/generations');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer rk-test-1');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      prompt: 'a fox logo',
      size: '1024x1024',
      style: 'vector_illustration',
      substyle: 'flat',
      model: 'recraftv3',
      n: 1,
    });

    expect(out.url).toBe('https://img.recraft.ai/x.png');
  });

  test('omits substyle/model when not provided', async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ url: 'https://x' }] }), { status: 200 }),
    );
    const t = new RestRecraftTransport('rk', fetchMock);
    await t.generateImage({ prompt: 'cat', size: '1024x1024', style: 'realistic_image' });
    const body = JSON.parse(
      ((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body).not.toHaveProperty('substyle');
    expect(body).not.toHaveProperty('model');
  });
});

describe('RestRecraftTransport — response parsing', () => {
  test('decodes b64_json when no url is returned', async () => {
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ b64_json: onePixelPng }] }), { status: 200 }),
    );
    const t = new RestRecraftTransport('rk', fetchMock);
    const out = await t.generateImage(ARGS);
    expect(out.url).toBeUndefined();
    expect(out.data).toBeInstanceOf(Uint8Array);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(out.data!.slice(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(out.mimeType).toBe('image/png');
  });

  test('missing both url and b64_json throws upstream_error', async () => {
    const fetchMock = mockFetch(new Response(JSON.stringify({ data: [{}] }), { status: 200 }));
    const t = new RestRecraftTransport('rk', fetchMock);
    await expect(t.generateImage(ARGS)).rejects.toMatchObject({ code: 'upstream_error' });
  });
});

describe('RestRecraftTransport — error mapping', () => {
  test('401 maps to unauthorized', async () => {
    const t = new RestRecraftTransport('rk', mockFetch(new Response('nope', { status: 401 })));
    await expect(t.generateImage(ARGS)).rejects.toMatchObject({ code: 'unauthorized' });
  });

  test('429 maps to rate_limited', async () => {
    const t = new RestRecraftTransport('rk', mockFetch(new Response('slow', { status: 429 })));
    await expect(t.generateImage(ARGS)).rejects.toMatchObject({ code: 'rate_limited' });
  });

  test('network error becomes upstream_unavailable', async () => {
    const throwing = vi
      .fn()
      .mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
    const t = new RestRecraftTransport('rk', throwing);
    await expect(t.generateImage(ARGS)).rejects.toMatchObject({ code: 'upstream_unavailable' });
  });
});

describe('RestRecraftTransport — Workers receiver binding (regression)', () => {
  // Mirror the DallePipeline #59 guard: the default fetch must keep its
  // receiver, or the Cloudflare Workers runtime throws "Illegal invocation".
  test('default fetch is invoked without losing its receiver', async () => {
    const realFetch = globalThis.fetch;
    function pickyFetch(this: unknown, _url: unknown, _init?: unknown): Promise<Response> {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: [{ url: 'https://x' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    globalThis.fetch = pickyFetch as unknown as typeof fetch;
    try {
      const t = new RestRecraftTransport('rk'); // default fetchImpl — the prod path
      const out = await t.generateImage(ARGS);
      expect(out.url).toBe('https://x');
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

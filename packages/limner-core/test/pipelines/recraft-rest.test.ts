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

describe('RestRecraftTransport — image-to-image (#15)', () => {
  test('an image URL routes to /images/imageToImage as multipart', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes('/images/imageToImage')) {
        return new Response(JSON.stringify({ data: [{ url: 'https://img.recraft.ai/out.png' }] }), {
          status: 200,
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    }) as unknown as typeof fetch;

    const t = new RestRecraftTransport('rk', fetchMock);
    const out = await t.generateImage({
      prompt: 'restyle',
      size: '1024x1024',
      style: 'realistic_image',
      image: 'https://src.example/x.png',
      strength: 0.4,
    });

    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => String(c[0]) === 'https://src.example/x.png')).toBe(true);
    const call = calls.find((c) => String(c[0]).includes('/images/imageToImage'))!;
    const init = call[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('prompt')).toBe('restyle');
    expect(form.get('strength')).toBe('0.4');
    expect(form.get('style')).toBe('realistic_image');
    expect(form.get('image')).toBeInstanceOf(Blob);
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(out.url).toBe('https://img.recraft.ai/out.png');
  });

  test('defaults strength to 0.5 when omitted', async () => {
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('/imageToImage')
        ? new Response(JSON.stringify({ data: [{ url: 'https://x' }] }), { status: 200 })
        : new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;
    const t = new RestRecraftTransport('rk', fetchMock);
    await t.generateImage({ prompt: 'x', size: '1024x1024', style: 'realistic_image', image: 'https://s/x.png' });
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes('imageToImage'),
    )!;
    expect(((call[1] as RequestInit).body as FormData).get('strength')).toBe('0.5');
  });
});

describe('RestRecraftTransport — crisp upscale (D-RA-14)', () => {
  test('fetches the source then POSTs multipart file to /images/crispUpscale', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes('/images/crispUpscale')) {
        return new Response(JSON.stringify({ image: { url: 'https://img.recraft.ai/up.png' } }), {
          status: 200,
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    }) as unknown as typeof fetch;

    const t = new RestRecraftTransport('rk-up', fetchMock);
    const out = await t.upscaleImage({ image: 'https://src.example/small.png' });

    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    // The source image is fetched server-side (URL in, never inline base64).
    expect(calls.some((c) => String(c[0]) === 'https://src.example/small.png')).toBe(true);
    const call = calls.find((c) => String(c[0]).includes('/images/crispUpscale'))!;
    const init = call[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(Blob);
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer rk-up');
    // No Content-Type — fetch derives the multipart boundary from FormData.
    expect(headers['Content-Type']).toBeUndefined();
    expect(out.url).toBe('https://img.recraft.ai/up.png');
  });

  test('forwards response_format and decodes b64_json as PNG', async () => {
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('/crispUpscale')
        ? new Response(JSON.stringify({ image: { b64_json: onePixelPng } }), { status: 200 })
        : new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;

    const t = new RestRecraftTransport('rk', fetchMock);
    const out = await t.upscaleImage({ image: 'https://s/x.png', responseFormat: 'b64_json' });
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes('crispUpscale'),
    )!;
    expect(((call[1] as RequestInit).body as FormData).get('response_format')).toBe('b64_json');
    expect(out.url).toBeUndefined();
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(out.data!.slice(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(out.mimeType).toBe('image/png');
  });

  test('401 maps to unauthorized', async () => {
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('/crispUpscale')
        ? new Response('nope', { status: 401 })
        : new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;
    const t = new RestRecraftTransport('rk', fetchMock);
    await expect(t.upscaleImage({ image: 'https://s/x.png' })).rejects.toMatchObject({
      code: 'unauthorized',
    });
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

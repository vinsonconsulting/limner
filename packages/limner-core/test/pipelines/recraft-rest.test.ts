import { describe, expect, test, vi } from 'vitest';

import { RestRecraftTransport, type RecraftGenerateArgs } from '../../src/index.js';

function mockFetch(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

// The SSRF guard now resolves source-image hostnames over DoH (1.1.1.1/dns-query)
// before fetching them. Wrap a transport's fetch so those lookups are answered
// with a public IP here, and every other call is delegated to `inner` — the mock
// the test inspects, which therefore still sees only the image + API calls.
function dohAware(inner: typeof fetch): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    if (String(url).startsWith('https://1.1.1.1/dns-query')) {
      const type = new URL(String(url)).searchParams.get('type');
      return new Response(
        JSON.stringify({ Status: 0, Answer: type === 'A' ? [{ type: 1, data: '203.0.113.10' }] : [] }),
        { status: 200, headers: { 'content-type': 'application/dns-json' } },
      );
    }
    return (inner as (u: unknown, i?: RequestInit) => Promise<Response>)(url, init);
  }) as unknown as typeof fetch;
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
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
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
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
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
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    await expect(t.generateImage(ARGS)).rejects.toMatchObject({ code: 'upstream_error' });
  });
});

describe('RestRecraftTransport — b64_json re-host (F4)', () => {
  test('forwards response_format in the generations JSON body when requested', async () => {
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ b64_json: onePixelPng }] }), { status: 200 }),
    );
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    const out = await t.generateImage({ ...ARGS, responseFormat: 'b64_json' });
    const body = JSON.parse(
      ((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.response_format).toBe('b64_json');
    expect(out.url).toBeUndefined();
    expect(out.data).toBeInstanceOf(Uint8Array);
  });

  test('forwards response_format in the imageToImage form when requested', async () => {
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('/imageToImage')
        ? new Response(JSON.stringify({ data: [{ b64_json: onePixelPng }] }), { status: 200 })
        : new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    await t.generateImage({ ...ARGS, image: 'https://s/x.png', responseFormat: 'b64_json' });
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes('/imageToImage'),
    )!;
    expect(((call[1] as RequestInit).body as FormData).get('response_format')).toBe('b64_json');
  });

  test('sniffs SVG mime for a b64_json generation result (vector style)', async () => {
    const svgB64 = btoa('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ b64_json: svgB64 }] }), { status: 200 }),
    );
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    const out = await t.generateImage({ ...ARGS, responseFormat: 'b64_json' });
    expect(out.mimeType).toBe('image/svg+xml');
    expect(new TextDecoder().decode(out.data!)).toContain('<svg');
  });

  test('fetches a url-only result through the guard when b64_json was requested', async () => {
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes('/images/generations')) {
        return new Response(JSON.stringify({ data: [{ url: 'https://img.recraft.ai/abc.png' }] }), {
          status: 200,
        });
      }
      return new Response(Uint8Array.from(atob(onePixelPng), (c) => c.charCodeAt(0)), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    }) as unknown as typeof fetch;
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    const out = await t.generateImage({ ...ARGS, responseFormat: 'b64_json' });
    // The hosted url was fetched and turned into bytes — no url leaks upward.
    expect(out.url).toBeUndefined();
    expect(out.data).toBeInstanceOf(Uint8Array);
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => String(c[0]) === 'https://img.recraft.ai/abc.png')).toBe(true);
  });

  // M1: the transform endpoints (upscale/vectorize) must apply the SAME
  // url-only fallback as the generate path, or they leak Recraft's CDN url.
  test('upscaleImage re-fetches a url-only result through the guard', async () => {
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes('/images/crispUpscale')) {
        return new Response(JSON.stringify({ image: { url: 'https://img.recraft.ai/up.png' } }), { status: 200 });
      }
      return new Response(Uint8Array.from(atob(onePixelPng), (c) => c.charCodeAt(0)), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    }) as unknown as typeof fetch;
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    const out = await t.upscaleImage({ image: 'https://s/x.png', responseFormat: 'b64_json' });
    expect(out.url).toBeUndefined();
    expect(out.data).toBeInstanceOf(Uint8Array);
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => String(c[0]) === 'https://img.recraft.ai/up.png')).toBe(true);
  });

  test('vectorizeImage re-fetches a url-only result and keeps svg mime', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes('/images/vectorize')) {
        return new Response(JSON.stringify({ image: { url: 'https://img.recraft.ai/out.svg' } }), { status: 200 });
      }
      if (String(url) === 'https://img.recraft.ai/out.svg') {
        return new Response(new TextEncoder().encode(svg), {
          status: 200,
          headers: { 'content-type': 'image/svg+xml' },
        });
      }
      return new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } });
    }) as unknown as typeof fetch;
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    const out = await t.vectorizeImage({ image: 'https://s/x.png', responseFormat: 'b64_json' });
    expect(out.url).toBeUndefined();
    expect(out.mimeType).toBe('image/svg+xml');
    expect(new TextDecoder().decode(out.data!)).toContain('<svg');
  });

  // L7: an SVG that opens with a comment or DOCTYPE before the root must still
  // be sniffed as image/svg+xml (generate-path b64, fallback would be png).
  test('sniffs SVG mime when the b64 result opens with a comment/DOCTYPE', async () => {
    const svgB64 = btoa('<!-- generated -->\n<!DOCTYPE svg>\n<svg xmlns="http://www.w3.org/2000/svg"/>');
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ b64_json: svgB64 }] }), { status: 200 }),
    );
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    const out = await t.generateImage({ ...ARGS, responseFormat: 'b64_json' });
    expect(out.mimeType).toBe('image/svg+xml');
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

    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
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
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
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

    const t = new RestRecraftTransport('rk-up', dohAware(fetchMock));
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

    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
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

  test('detects WebP bytes and stamps image/webp, not the caller-supplied png', async () => {
    // crispUpscale's b64_json path returns WebP, not PNG (observed against the
    // live endpoint). The mime must reflect the actual bytes so the delivered
    // artifact is stored and served with the right extension/content-type.
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, // 'RIFF' + size
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, // 'WEBP' 'VP8L'
    ]);
    const webpB64 = btoa(String.fromCharCode(...webpBytes));
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('/crispUpscale')
        ? new Response(JSON.stringify({ image: { b64_json: webpB64 } }), { status: 200 })
        : new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;

    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    const out = await t.upscaleImage({ image: 'https://s/x.png', responseFormat: 'b64_json' });
    expect(out.mimeType).toBe('image/webp');
    expect(out.data!.slice(0, 4)).toEqual(new Uint8Array([0x52, 0x49, 0x46, 0x46]));
  });

  test('401 maps to unauthorized', async () => {
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('/crispUpscale')
        ? new Response('nope', { status: 401 })
        : new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    await expect(t.upscaleImage({ image: 'https://s/x.png' })).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });
});

describe('RestRecraftTransport — vectorize (D-RA-14)', () => {
  test('POSTs multipart file to /images/vectorize and stamps svg mime on b64', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const svgB64 = btoa(svg);
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('/images/vectorize')
        ? new Response(JSON.stringify({ image: { b64_json: svgB64 } }), { status: 200 })
        : new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;

    const t = new RestRecraftTransport('rk-vec', dohAware(fetchMock));
    const out = await t.vectorizeImage({
      image: 'https://src.example/logo.png',
      responseFormat: 'b64_json',
    });
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes('/images/vectorize'),
    )!;
    const init = call[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('file')).toBeInstanceOf(Blob);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer rk-vec');
    expect(out.mimeType).toBe('image/svg+xml');
    expect(new TextDecoder().decode(out.data!)).toContain('<svg');
  });

  test('returns the hosted url when Recraft responds with one', async () => {
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('/vectorize')
        ? new Response(JSON.stringify({ image: { url: 'https://img.recraft.ai/out.svg' } }), {
            status: 200,
          })
        : new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;
    const t = new RestRecraftTransport('rk', dohAware(fetchMock));
    const out = await t.vectorizeImage({ image: 'https://s/x.png' });
    expect(out.url).toBe('https://img.recraft.ai/out.svg');
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

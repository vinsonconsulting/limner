import { describe, test, expect, vi } from 'vitest';

import { assertSafeImageUrl, safeFetchImage } from '../../src/pipelines/_url-guard.js';
import { fetchInputImage } from '../../src/pipelines/_image-input.js';

const ID = 'test';

// Capture the PipelineError `code` from a sync throw (or undefined if none).
function syncCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

// Capture the PipelineError `code` from a rejected promise (or undefined).
async function asyncCode(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

// A fetch mock returning image bytes for any URL.
function imageFetch(): typeof fetch {
  return vi.fn(
    async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
  ) as unknown as typeof fetch;
}

describe('assertSafeImageUrl — scheme allowlist', () => {
  test('accepts a normal public https URL and returns the parsed URL', () => {
    const url = assertSafeImageUrl(ID, 'https://images.example.com/cat.png');
    expect(url.href).toBe('https://images.example.com/cat.png');
  });

  test('accepts a public http URL', () => {
    expect(syncCode(() => assertSafeImageUrl(ID, 'http://images.example.com/cat.png'))).toBeUndefined();
  });

  test.each([
    'file:///etc/passwd',
    'gopher://evil.example/_',
    'data:text/plain;base64,AAAA',
    'ftp://host.example/x',
    'blob:https://evil.example/abc',
  ])('rejects non-http(s) scheme: %s', (u) => {
    expect(syncCode(() => assertSafeImageUrl(ID, u))).toBe('invalid_input');
  });

  test('rejects a malformed URL', () => {
    expect(syncCode(() => assertSafeImageUrl(ID, 'not a url'))).toBe('invalid_input');
  });
});

describe('assertSafeImageUrl — blocks private / loopback / link-local / metadata', () => {
  test.each([
    'http://127.0.0.1/x',
    'http://127.5.5.5/x',
    'http://10.0.0.1/x',
    'http://10.255.255.255/x',
    'http://172.16.0.1/x',
    'http://172.31.255.255/x',
    'http://192.168.1.1/x',
    'http://169.254.169.254/latest/meta-data/', // cloud metadata
    'http://0.0.0.0/x',
    'http://100.64.0.1/x', // CGNAT
    'http://[::1]/x',
    'http://[fc00::1]/x',
    'http://[fd12:3456:789a::1]/x',
    'http://[fe80::1]/x',
    'http://[::ffff:127.0.0.1]/x', // IPv4-mapped loopback
    'http://localhost/x',
    'http://foo.localhost/x',
    'http://metadata.google.internal/x',
    'http://svc.cluster.internal/x',
  ])('rejects %s', (u) => {
    expect(syncCode(() => assertSafeImageUrl(ID, u))).toBe('invalid_input');
  });

  test('rejects integer-encoded loopback (URL parser normalizes to 127.0.0.1)', () => {
    expect(syncCode(() => assertSafeImageUrl(ID, 'http://2130706433/x'))).toBe('invalid_input');
  });

  test('rejects a trailing-dot FQDN form of an internal host', () => {
    expect(syncCode(() => assertSafeImageUrl(ID, 'http://localhost./x'))).toBe('invalid_input');
    expect(syncCode(() => assertSafeImageUrl(ID, 'http://127.0.0.1./x'))).toBe('invalid_input');
  });

  test('does NOT block public IP literals just outside the private ranges', () => {
    expect(syncCode(() => assertSafeImageUrl(ID, 'http://8.8.8.8/x'))).toBeUndefined();
    expect(syncCode(() => assertSafeImageUrl(ID, 'http://172.32.0.1/x'))).toBeUndefined();
    expect(syncCode(() => assertSafeImageUrl(ID, 'http://192.169.0.1/x'))).toBeUndefined();
    expect(syncCode(() => assertSafeImageUrl(ID, 'http://[2606:4700::1111]/x'))).toBeUndefined();
  });
});

describe('safeFetchImage — redirect re-validation', () => {
  test('follows a redirect to another public URL and returns the final response', async () => {
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url) === 'https://a.example/1'
        ? new Response(null, { status: 302, headers: { location: 'https://b.example/2' } })
        : new Response(new Uint8Array([9]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;

    const res = await safeFetchImage(ID, 'https://a.example/1', fetchMock);
    expect(res.status).toBe(200);
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(2);
    // Every hop is fetched in manual-redirect mode so we re-validate each Location.
    expect((calls[0]![1] as RequestInit).redirect).toBe('manual');
  });

  test('resolves a relative redirect Location against the current URL', async () => {
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url) === 'https://a.example/dir/1'
        ? new Response(null, { status: 301, headers: { location: '/img/2.png' } })
        : new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;

    const res = await safeFetchImage(ID, 'https://a.example/dir/1', fetchMock);
    expect(res.status).toBe(200);
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[1]![0])).toBe('https://a.example/img/2.png');
  });

  test('rejects a redirect that targets an internal address (SSRF via 302)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/' } }),
    ) as unknown as typeof fetch;
    expect(await asyncCode(() => safeFetchImage(ID, 'https://a.example/1', fetchMock))).toBe('invalid_input');
  });

  test('rejects when redirects exceed the hop cap', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'https://a.example/loop' } }),
    ) as unknown as typeof fetch;
    expect(
      await asyncCode(() => safeFetchImage(ID, 'https://a.example/1', fetchMock, { maxRedirects: 2 })),
    ).toBe('invalid_input');
  });

  test('passes the original URL string to fetch on the first hop (preserves call shape)', async () => {
    const fetchMock = imageFetch();
    await safeFetchImage(ID, 'https://src.example/x.png', fetchMock);
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0]![0])).toBe('https://src.example/x.png');
  });
});

describe('fetchInputImage — guard integration, size + timeout caps', () => {
  test('rejects a private-address input URL before issuing any fetch', async () => {
    const fetchMock = imageFetch();
    expect(await asyncCode(() => fetchInputImage(ID, 'http://10.0.0.1/x.png', fetchMock))).toBe('invalid_input');
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  test('accepts a normal public image and returns bytes + content-type', async () => {
    const out = await fetchInputImage(ID, 'https://ok.example/x.png', imageFetch());
    expect(out.contentType).toBe('image/png');
    expect(out.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  test('caps the response body size', async () => {
    const big = new Uint8Array(64).fill(7);
    const fetchMock = vi.fn(
      async () => new Response(big, { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;
    expect(await asyncCode(() => fetchInputImage(ID, 'https://ok.example/big.png', fetchMock, undefined, { maxBytes: 16 }))).toBe(
      'invalid_input',
    );
  });

  test('maps a timeout to upstream_unavailable', async () => {
    // A fetch that never resolves until its signal aborts.
    const fetchMock = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          const sig = init!.signal!;
          sig.addEventListener('abort', () => reject(sig.reason ?? new DOMException('aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;
    expect(
      await asyncCode(() => fetchInputImage(ID, 'https://slow.example/x.png', fetchMock, undefined, { timeoutMs: 10 })),
    ).toBe('upstream_unavailable');
  });

  test('maps a caller-initiated abort to aborted', async () => {
    const ac = new AbortController();
    const fetchMock = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          const sig = init!.signal!;
          sig.addEventListener('abort', () => reject(sig.reason ?? new DOMException('aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;
    const p = fetchInputImage(ID, 'https://slow.example/x.png', fetchMock, ac.signal);
    ac.abort();
    expect(await asyncCode(() => p)).toBe('aborted');
  });
});

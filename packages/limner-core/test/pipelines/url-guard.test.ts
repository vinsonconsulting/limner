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

// A stub host resolver that maps a hostname to fixed IPs, defaulting to a public
// TEST-NET-3 address (203.0.113.0/24, RFC 5737) so hostname tests don't hit the
// network. Pass this as opts.resolveHost wherever a host needs DNS re-validation.
const PUBLIC_IP = '203.0.113.10';
function stubResolve(map: Record<string, string[]> = {}): (host: string) => Promise<string[]> {
  return async (host: string) => map[host] ?? [PUBLIC_IP];
}
const pubResolve = stubResolve();

// A fetch mock that answers DoH JSON queries (type=A / type=AAAA) from `records`
// and returns image bytes for everything else — exercises the *default* resolver.
function dohAndImageFetch(records: { A?: string[]; AAAA?: string[] }): typeof fetch {
  return vi.fn(async (input: unknown) => {
    const u = String(input);
    if (u.startsWith('https://1.1.1.1/dns-query')) {
      const type = new URL(u).searchParams.get('type');
      const data = (type === 'AAAA' ? records.AAAA : records.A) ?? [];
      return new Response(
        JSON.stringify({ Status: 0, Answer: data.map((d) => ({ type: type === 'AAAA' ? 28 : 1, data: d })) }),
        { status: 200, headers: { 'content-type': 'application/dns-json' } },
      );
    }
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } });
  }) as unknown as typeof fetch;
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

    const res = await safeFetchImage(ID, 'https://a.example/1', fetchMock, { resolveHost: pubResolve });
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

    const res = await safeFetchImage(ID, 'https://a.example/dir/1', fetchMock, { resolveHost: pubResolve });
    expect(res.status).toBe(200);
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[1]![0])).toBe('https://a.example/img/2.png');
  });

  test('rejects a redirect that targets an internal address (SSRF via 302)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/' } }),
    ) as unknown as typeof fetch;
    expect(
      await asyncCode(() => safeFetchImage(ID, 'https://a.example/1', fetchMock, { resolveHost: pubResolve })),
    ).toBe('invalid_input');
  });

  test('rejects when redirects exceed the hop cap', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'https://a.example/loop' } }),
    ) as unknown as typeof fetch;
    expect(
      await asyncCode(() =>
        safeFetchImage(ID, 'https://a.example/1', fetchMock, { maxRedirects: 2, resolveHost: pubResolve }),
      ),
    ).toBe('invalid_input');
  });

  test('passes the original URL string to fetch on the first hop (preserves call shape)', async () => {
    const fetchMock = imageFetch();
    await safeFetchImage(ID, 'https://src.example/x.png', fetchMock, { resolveHost: pubResolve });
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
    const out = await fetchInputImage(ID, 'https://ok.example/x.png', imageFetch(), undefined, {
      resolveHost: pubResolve,
    });
    expect(out.contentType).toBe('image/png');
    expect(out.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  test('caps the response body size', async () => {
    const big = new Uint8Array(64).fill(7);
    const fetchMock = vi.fn(
      async () => new Response(big, { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;
    expect(
      await asyncCode(() =>
        fetchInputImage(ID, 'https://ok.example/big.png', fetchMock, undefined, {
          maxBytes: 16,
          resolveHost: pubResolve,
        }),
      ),
    ).toBe('invalid_input');
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
      await asyncCode(() =>
        fetchInputImage(ID, 'https://slow.example/x.png', fetchMock, undefined, {
          timeoutMs: 10,
          resolveHost: pubResolve,
        }),
      ),
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
    const p = fetchInputImage(ID, 'https://slow.example/x.png', fetchMock, ac.signal, { resolveHost: pubResolve });
    ac.abort();
    expect(await asyncCode(() => p)).toBe('aborted');
  });
});

describe('safeFetchImage — DoH host resolution (DNS rebinding)', () => {
  function callCount(f: typeof fetch): number {
    return (f as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
  }

  test('rejects a hostname that resolves to a private IP before any image fetch', async () => {
    const fetchMock = imageFetch();
    const resolveHost = stubResolve({ 'evil.example': ['10.0.0.1'] });
    expect(await asyncCode(() => safeFetchImage(ID, 'https://evil.example/x.png', fetchMock, { resolveHost }))).toBe(
      'invalid_input',
    );
    expect(callCount(fetchMock)).toBe(0);
  });

  test('rejects a hostname that resolves to the cloud metadata IP', async () => {
    const fetchMock = imageFetch();
    const resolveHost = stubResolve({ 'rebind.example': ['169.254.169.254'] });
    expect(await asyncCode(() => safeFetchImage(ID, 'https://rebind.example/x', fetchMock, { resolveHost }))).toBe(
      'invalid_input',
    );
    expect(callCount(fetchMock)).toBe(0);
  });

  test('accepts a hostname that resolves to a public IP and fetches it', async () => {
    const fetchMock = imageFetch();
    const resolveHost = stubResolve({ 'img.example': ['203.0.113.10'] });
    const res = await safeFetchImage(ID, 'https://img.example/x.png', fetchMock, { resolveHost });
    expect(res.status).toBe(200);
    expect(callCount(fetchMock)).toBe(1);
  });

  test('rejects when split A records include a private one (any-blocked)', async () => {
    const fetchMock = imageFetch();
    const resolveHost = stubResolve({ 'mixed.example': ['203.0.113.10', '10.0.0.1'] });
    expect(await asyncCode(() => safeFetchImage(ID, 'https://mixed.example/x', fetchMock, { resolveHost }))).toBe(
      'invalid_input',
    );
    expect(callCount(fetchMock)).toBe(0);
  });

  test('rejects a hostname whose AAAA record is a ULA / link-local address', async () => {
    const fetchMock = imageFetch();
    const resolveHost = stubResolve({ 'v6.example': ['fc00::1'] });
    expect(await asyncCode(() => safeFetchImage(ID, 'https://v6.example/x', fetchMock, { resolveHost }))).toBe(
      'invalid_input',
    );
    expect(callCount(fetchMock)).toBe(0);
  });

  test('rejects a redirect target hostname that resolves to a private IP', async () => {
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url) === 'https://a.example/1'
        ? new Response(null, { status: 302, headers: { location: 'https://inner.example/2' } })
        : new Response(new Uint8Array([9]), { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;
    const resolveHost = stubResolve({ 'a.example': ['203.0.113.10'], 'inner.example': ['10.0.0.1'] });
    expect(await asyncCode(() => safeFetchImage(ID, 'https://a.example/1', fetchMock, { resolveHost }))).toBe(
      'invalid_input',
    );
    // Only the first hop is fetched; the redirect target is rejected at DoH before its fetch.
    expect(callCount(fetchMock)).toBe(1);
  });

  test('fails closed when DoH resolution fails at the network level', async () => {
    const fetchMock = imageFetch();
    const resolveHost = () => Promise.reject(new Error('DoH unreachable'));
    expect(await asyncCode(() => safeFetchImage(ID, 'https://img.example/x', fetchMock, { resolveHost }))).toBe(
      'upstream_unavailable',
    );
    expect(callCount(fetchMock)).toBe(0);
  });

  test('fails closed when the host resolves to no records', async () => {
    const fetchMock = imageFetch();
    const resolveHost = stubResolve({ 'nxdomain.example': [] });
    expect(await asyncCode(() => safeFetchImage(ID, 'https://nxdomain.example/x', fetchMock, { resolveHost }))).toBe(
      'invalid_input',
    );
    expect(callCount(fetchMock)).toBe(0);
  });

  test('does not resolve literal-IP hosts (resolver is never consulted)', async () => {
    const fetchMock = imageFetch();
    const resolveHost = vi.fn(async () => {
      throw new Error('resolver must not be called for a literal IP');
    });
    const res = await safeFetchImage(ID, 'http://8.8.8.8/x.png', fetchMock, { resolveHost });
    expect(res.status).toBe(200);
    expect(resolveHost).not.toHaveBeenCalled();
  });

  test('default DoH resolver queries A + AAAA with the dns-json header and validates the answer', async () => {
    const fetchMock = dohAndImageFetch({ A: ['203.0.113.10'], AAAA: [] });
    const res = await safeFetchImage(ID, 'https://img.example/x.png', fetchMock);
    expect(res.status).toBe(200);
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const dohCalls = calls.filter((c) => String(c[0]).startsWith('https://1.1.1.1/dns-query'));
    expect(dohCalls.some((c) => String(c[0]).includes('type=A'))).toBe(true);
    expect(dohCalls.some((c) => String(c[0]).includes('type=AAAA'))).toBe(true);
    expect((dohCalls[0]![1] as RequestInit).headers).toMatchObject({ accept: 'application/dns-json' });
  });

  test('default DoH resolver rejects when the A record resolves private (no image fetch)', async () => {
    const fetchMock = dohAndImageFetch({ A: ['10.0.0.1'], AAAA: [] });
    expect(await asyncCode(() => safeFetchImage(ID, 'https://img.example/x.png', fetchMock))).toBe('invalid_input');
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.every((c) => String(c[0]).startsWith('https://1.1.1.1/dns-query'))).toBe(true);
  });
});

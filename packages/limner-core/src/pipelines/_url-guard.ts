// SSRF guard for server-side fetches of caller-supplied image URLs.
//
// Every image-input / transform pipeline (#15 image-input, D-RA-14 upscale /
// vectorize) fetches a URL the *caller* chose, server-side, with the worker's
// own egress. Without a guard a caller could point that fetch at cloud
// metadata (169.254.169.254), loopback, or an internal service. This module:
//   - restricts the scheme to http(s) (rejects file:/gopher:/data:/blob:/…),
//   - blocks private, loopback, link-local, CGNAT, and IPv4-mapped-private
//     hosts — including integer/hex-encoded forms, which the WHATWG URL parser
//     normalizes to dotted-decimal for us before we ever inspect the host,
//   - resolves hostnames over DoH (DNS-over-HTTPS) and re-checks every resolved
//     A/AAAA address against the same blocklist, so a public-looking hostname
//     that resolves to a private IP is rejected before the fetch,
//   - re-validates the target after every redirect hop (manual redirects), so
//     a public URL cannot 302 to an internal one,
//   - caps redirect depth and (via the caller) request time.
//
// Residual (documented, runtime-bounded): an *active* DNS-rebinding attacker can
// still flip the answer between our DoH check and the Workers runtime's own
// resolution at fetch() time (a TOCTOU window). We cannot fully close this on
// Workers because the connect IP can't be pinned for arbitrary external hosts:
// `fetch(url, { cf: { resolveOverride } })` only takes effect when both hosts are
// within your own Cloudflare zone and is ignored for off-zone hosts, so we don't
// use it — a no-op pin would be false assurance. DoH A/AAAA validation closes the
// common *static* hostname→private-IP case; the narrow active-rebinding window
// remains.

import { PipelineError } from './errors.js';

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_REDIRECTS = 3;
export const DEFAULT_DOH_ENDPOINT = 'https://1.1.1.1/dns-query';
export const DEFAULT_DOH_TIMEOUT_MS = 5_000;

/** Resolve a hostname to its A/AAAA addresses (IP strings). Injectable for tests. */
export type HostResolver = (host: string, signal?: AbortSignal) => Promise<string[]>;

export interface SafeFetchOptions {
  /** Per-request timeout in milliseconds. Default 15s. */
  timeoutMs?: number;
  /** Max redirect hops to follow; each hop is re-validated. Default 3. */
  maxRedirects?: number;
  /**
   * Resolve a hostname to its IP addresses for SSRF re-validation. Defaults to a
   * DoH (DNS-over-HTTPS) lookup via `fetchImpl`. Inject a stub in tests to avoid
   * real network I/O.
   */
  resolveHost?: HostResolver;
  /** DoH JSON endpoint used by the default resolver. Default 1.1.1.1. */
  dohEndpoint?: string;
  /** Per-query timeout for the default DoH resolver, in ms. Default 5s. */
  dohTimeoutMs?: number;
}

function invalidUrl(pipelineId: string, message: string): PipelineError {
  return new PipelineError(pipelineId, 'invalid_input', `${pipelineId}: ${message}`);
}

// Hostnames that must never be fetched regardless of what DNS would return.
// The 169.254.169.254 metadata IP is already covered by the link-local v4
// range; these catch the named aliases (localhost, *.internal, …).
function isBlockedHostname(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'internal' ||
    host.endsWith('.internal')
  );
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] as const;
  if (o.some((n) => n > 255)) return null;
  return [o[0], o[1], o[2], o[3]];
}

function isPrivateIpv4(o: readonly [number, number, number, number]): boolean {
  const [a, b] = o;
  return (
    a === 0 || // 0.0.0.0/8 "this host"
    a === 10 || // 10/8 private
    a === 127 || // 127/8 loopback
    (a === 169 && b === 254) || // 169.254/16 link-local (incl. 169.254.169.254 metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12 private
    (a === 192 && b === 168) || // 192.168/16 private
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
    (a === 255 && b === 255 && o[2] === 255 && o[3] === 255) // broadcast
  );
}

// Parse an IPv6 literal (without brackets, zone id tolerated) into 16 bytes,
// handling `::` compression and an embedded IPv4 tail. Returns null if the
// string isn't a well-formed IPv6 address.
function parseIpv6(input: string): Uint8Array | null {
  let s = input.toLowerCase();
  const pct = s.indexOf('%');
  if (pct >= 0) s = s.slice(0, pct);
  if (!s.includes(':')) return null;

  // Fold an embedded IPv4 tail (e.g. ::ffff:127.0.0.1) into two hextets.
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const hasGap = halves.length === 2;
  const tailGroups = hasGap ? (halves[1] ? halves[1].split(':') : []) : [];

  const groups: string[] = [];
  if (!hasGap) {
    if (head.length !== 8) return null;
    groups.push(...head);
  } else {
    const missing = 8 - (head.length + tailGroups.length);
    if (missing < 1) return null;
    groups.push(...head, ...new Array(missing).fill('0'), ...tailGroups);
  }
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const g = groups[i]!;
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const v = parseInt(g, 16);
    bytes[i * 2] = (v >> 8) & 0xff;
    bytes[i * 2 + 1] = v & 0xff;
  }
  return bytes;
}

function isBlockedIpv6(b: Uint8Array): boolean {
  const allZeroExceptLast = b.slice(0, 15).every((x) => x === 0);
  if (allZeroExceptLast && b[15] === 1) return true; // ::1 loopback
  if (b.every((x) => x === 0)) return true; // :: unspecified
  if ((b[0]! & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (b[0] === 0xfe && (b[1]! & 0xc0) === 0x80) return true; // fe80::/10 link-local
  // IPv4-mapped (::ffff:a.b.c.d): block when the embedded v4 is private.
  const mapped = b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff;
  if (mapped && isPrivateIpv4([b[12]!, b[13]!, b[14]!, b[15]!])) return true;
  return false;
}

// url.hostname brackets IPv6 literals; strip them before inspection. A trailing
// dot (FQDN form, e.g. `localhost.`) resolves the same as without, so drop it
// too — otherwise it slips past the hostname/IP checks.
function normalizeHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '');
}

// Classify a single IP string against the private/loopback/metadata blocklist.
// 'unparseable' (a DoH answer our parsers don't recognize) is treated as unsafe
// by callers — fail closed rather than fetch an address we couldn't vet.
function classifyIp(ip: string): 'blocked' | 'allowed' | 'unparseable' {
  const v4 = parseIpv4(ip);
  if (v4) return isPrivateIpv4(v4) ? 'blocked' : 'allowed';
  const v6 = parseIpv6(ip);
  if (v6) return isBlockedIpv6(v6) ? 'blocked' : 'allowed';
  return 'unparseable';
}

/**
 * Validate a caller-supplied URL for server-side fetching. Throws a
 * PipelineError('invalid_input') for an unsupported scheme or a host that
 * resolves to a private / loopback / link-local / metadata address. Returns
 * the parsed URL on success.
 */
export function assertSafeImageUrl(pipelineId: string, raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalidUrl(pipelineId, `not a valid URL: ${raw}`);
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw invalidUrl(pipelineId, `unsupported URL scheme '${url.protocol}' (only http/https allowed)`);
  }
  const host = normalizeHost(url.hostname);
  if (!host) throw invalidUrl(pipelineId, 'URL has no host');
  if (isBlockedHostname(host)) {
    throw invalidUrl(pipelineId, `refusing to fetch internal host '${url.hostname}'`);
  }
  const v4 = parseIpv4(host);
  if (v4 && isPrivateIpv4(v4)) {
    throw invalidUrl(pipelineId, `refusing to fetch private/loopback address '${url.hostname}'`);
  }
  const v6 = parseIpv6(host);
  if (v6 && isBlockedIpv6(v6)) {
    throw invalidUrl(pipelineId, `refusing to fetch private/loopback address '${url.hostname}'`);
  }
  return url;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Combine a timeout with an optional caller signal into one AbortSignal,
// runtime-agnostically (no dependency on AbortSignal.any/timeout). Returns a
// cleanup to clear the timer and detach the listener.
function withTimeout(
  timeoutMs: number,
  signal: AbortSignal | undefined,
): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timed out', 'TimeoutError')), timeoutMs);
  const onAbort = () => ctrl.abort((signal as AbortSignal).reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

// Resolve a hostname's A/AAAA records over DoH (DNS-over-HTTPS, JSON). Issues the
// A and AAAA queries in parallel through the worker's own `fetchImpl`, each with
// its own timeout. Returns the union of resolved IP strings. Throws
// PipelineError('upstream_unavailable') only when *both* queries fail at the
// network level (can't verify → fail closed); a query that succeeds with no
// records returns an empty list, which the caller treats as "no allowed address".
async function dohResolve(
  pipelineId: string,
  host: string,
  fetchImpl: typeof fetch,
  endpoint: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<string[]> {
  const query = async (type: 'A' | 'AAAA'): Promise<string[]> => {
    const { signal: combined, cleanup } = withTimeout(timeoutMs, signal);
    try {
      const u = `${endpoint}?name=${encodeURIComponent(host)}&type=${type}`;
      const res = await fetchImpl(u, { headers: { accept: 'application/dns-json' }, signal: combined });
      if (!res.ok) return [];
      const body = (await res.json()) as {
        Status?: number;
        Answer?: Array<{ type?: number; data?: string }>;
      };
      // RR types: 1 = A, 28 = AAAA. Other answers (CNAME, …) are ignored — the
      // resolver chases CNAMEs and returns the final address records for us.
      if (body.Status !== 0 || !Array.isArray(body.Answer)) return [];
      return body.Answer
        .filter((a) => a.type === 1 || a.type === 28)
        .map((a) => a.data)
        .filter((d): d is string => typeof d === 'string');
    } finally {
      cleanup();
    }
  };

  const settled = await Promise.allSettled([query('A'), query('AAAA')]);
  const ok = settled.filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled');
  if (ok.length === 0) {
    throw new PipelineError(
      pipelineId,
      'upstream_unavailable',
      `${pipelineId}: could not resolve '${host}' (DoH lookup failed)`,
    );
  }
  return ok.flatMap((r) => r.value);
}

// Re-validate a host about to be fetched by resolving it and checking every
// resolved address. Literal-IP hosts are skipped — `fetch` connects straight to
// that already-vetted IP, so there's no DNS step to rebind. Fails closed: a host
// that resolves to no allowed address (empty, or any private / unparseable
// answer) is rejected before the fetch.
async function assertResolvedHostSafe(
  pipelineId: string,
  url: URL,
  resolve: HostResolver,
  signal: AbortSignal | undefined,
): Promise<void> {
  const host = normalizeHost(url.hostname);
  if (parseIpv4(host) || parseIpv6(host)) return;

  let ips: string[];
  try {
    ips = await resolve(host, signal);
  } catch (err) {
    // Fail closed: any resolver failure means we couldn't vet the host. The
    // default DoH resolver already raises a classified PipelineError; wrap
    // anything else (e.g. an injected resolver) as upstream_unavailable.
    if (err instanceof PipelineError) throw err;
    throw new PipelineError(
      pipelineId,
      'upstream_unavailable',
      `${pipelineId}: could not resolve '${host}' (${stringifyError(err)})`,
      err,
    );
  }
  if (ips.length === 0) {
    throw invalidUrl(pipelineId, `host '${host}' did not resolve to any address`);
  }
  for (const ip of ips) {
    if (classifyIp(ip) !== 'allowed') {
      throw invalidUrl(
        pipelineId,
        `refusing to fetch '${host}' — it resolves to a private/loopback address`,
      );
    }
  }
}

/**
 * Fetch a caller-supplied URL with SSRF protection: validates the initial
 * URL and every redirect target, follows redirects manually (so each hop is
 * re-checked), and applies a timeout. Returns the final non-redirect Response
 * (the caller checks `res.ok` and reads the body). Throws PipelineError —
 * 'invalid_input' for a blocked URL / bad redirect, 'aborted' for a
 * caller-initiated abort, 'upstream_unavailable' for a timeout or network
 * failure.
 */
export async function safeFetchImage(
  pipelineId: string,
  rawUrl: string,
  fetchImpl: typeof fetch,
  opts: SafeFetchOptions = {},
  signal?: AbortSignal,
): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const dohEndpoint = opts.dohEndpoint ?? DEFAULT_DOH_ENDPOINT;
  const dohTimeoutMs = opts.dohTimeoutMs ?? DEFAULT_DOH_TIMEOUT_MS;
  const resolveHost: HostResolver =
    opts.resolveHost ?? ((host, sig) => dohResolve(pipelineId, host, fetchImpl, dohEndpoint, dohTimeoutMs, sig));

  let current = assertSafeImageUrl(pipelineId, rawUrl);
  // First hop uses the original string so the call shape is byte-identical to
  // the un-guarded path callers/tests observe; later hops use the resolved href.
  let target = rawUrl;

  for (let hop = 0; ; hop++) {
    // Resolve + re-check the host before each fetch (initial URL and every
    // redirect target): closes the static hostname→private-IP rebinding case.
    try {
      await assertResolvedHostSafe(pipelineId, current, resolveHost, signal);
    } catch (err) {
      if (signal?.aborted) {
        throw new PipelineError(pipelineId, 'aborted', `${pipelineId}: input image fetch aborted`, err);
      }
      throw err;
    }
    // The DoH check above awaits; if the caller aborted in the meantime, don't
    // issue a fetch we already know is doomed.
    if (signal?.aborted) {
      throw new PipelineError(pipelineId, 'aborted', `${pipelineId}: input image fetch aborted`);
    }
    const { signal: combined, cleanup } = withTimeout(timeoutMs, signal);
    let res: Response;
    try {
      // Manual redirect: server runtimes (Node/undici, Workers) return the real
      // 3xx response with a readable Location, unlike a browser's opaqueredirect.
      res = await fetchImpl(target, { redirect: 'manual', signal: combined });
    } catch (err) {
      if (signal?.aborted) {
        throw new PipelineError(pipelineId, 'aborted', `${pipelineId}: input image fetch aborted`, err);
      }
      throw new PipelineError(
        pipelineId,
        'upstream_unavailable',
        `${pipelineId}: input image fetch failed: ${stringifyError(err)}`,
        err,
      );
    } finally {
      cleanup();
    }

    if (!REDIRECT_STATUSES.has(res.status)) return res;
    if (hop >= maxRedirects) {
      throw invalidUrl(pipelineId, `too many redirects fetching input image (> ${maxRedirects})`);
    }
    const location = res.headers.get('location');
    if (!location) throw invalidUrl(pipelineId, 'redirect without a Location header fetching input image');
    const next = new URL(location, current);
    assertSafeImageUrl(pipelineId, next.href);
    current = next;
    target = next.href;
  }
}

function stringifyError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

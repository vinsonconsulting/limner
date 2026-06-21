// D-RA-22 consent screen — handler logic + stateless CSRF.
//
// The /authorize flow:
//   • Trusted first-party clients (OAUTH_TRUSTED_CLIENT_IDS — notably the live
//     CMA agent) auto-approve with no UI, exactly as the dogfood build did.
//   • Everyone else gets a real approve/deny consent page, protected by a
//     signed CSRF token carried as both a hidden form field and a `__Host-`
//     cookie (double-submit). The token also CARRIES the original auth request
//     (HMAC-signed), so the POST reconstructs it from the verified payload
//     rather than trusting loose form fields — tampering breaks the MAC.
//   • The issued scope stays PINNED to ['mcp'] (D-RA-19) on the approve path.
//
// The CSRF HMAC primitives mirror the artifact-URL signing pattern in
// packages/limner-core/src/delivery/r2.ts (signArtifact / verifyArtifactSignature).
// They are duplicated here on purpose — keeping the auth surface self-contained
// rather than widening @limner/core's public API for ~25 lines of crypto glue.
//
// Refs: D-RA-06, D-RA-12, D-RA-19, D-RA-22

import type { AuthRequest, OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import type { KVNamespace } from '@cloudflare/workers-types';

import { renderConsentPage } from './consent-template.js';

// The OAuth provider injects an OAuthHelpers instance under env.OAUTH_PROVIDER.
// Both the apiHandler and defaultHandler see it.
export interface OAuthEnv {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: KVNamespace;
  // Comma-separated allowlist of first-party OAuth client_ids that bypass the
  // consent UI and auto-approve (agent-compat). Plain var (a client_id is
  // public, A4-safe to commit); absent/empty means no client is trusted.
  // NOTE: the live agent's "Claude" client ROTATES its client_id, so prefer
  // OAUTH_TRUSTED_REDIRECT_URIS for it; this var stays for pinning fixed ids.
  OAUTH_TRUSTED_CLIENT_IDS?: string;
  // Comma-separated allowlist of first-party redirect_uris that bypass the
  // consent UI and auto-approve. This is the durable agent-compat signal: the
  // live agent's first-party client registers with a STABLE redirect_uri
  // (https://claude.ai/api/mcp/auth_callback) but a rotating client_id. Trusting
  // the redirect_uri is safe because the authorization code is only ever
  // delivered to that URI (Anthropic), so a spoofed client_name can't intercept
  // it. Plain var (a redirect_uri is public, A4-safe); absent/empty trusts none.
  OAUTH_TRUSTED_REDIRECT_URIS?: string;
  // HMAC-SHA256 secret for the consent CSRF token. A SECRET (set via
  // `wrangler secret put`), never committed. When absent the consent flow fails
  // closed for non-trusted clients (a public deploy without it is a
  // misconfiguration; trusted clients still auto-approve independently).
  OAUTH_CONSENT_SIGNING_KEY?: string;
}

/** Lifetime of a minted consent/CSRF token, in seconds. */
const CONSENT_TOKEN_TTL_SECONDS = 600;

/** Cookie name for the double-submit CSRF token. `__Host-` forces Secure +
 * Path=/ + host-only, so a subdomain or non-HTTPS origin cannot plant it. */
const CSRF_COOKIE = '__Host-limner_csrf';

const CONSENT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'";

/**
 * Returns true when `clientId` appears in the OAUTH_TRUSTED_CLIENT_IDS
 * allowlist (comma-separated, surrounding whitespace ignored). Trusted
 * first-party clients — notably the live CMA agent — skip the consent screen
 * and auto-approve, which keeps their auth working across a fresh re-grant.
 *
 * An absent/empty allowlist trusts nobody; an empty or missing clientId is
 * never trusted (blank list entries are filtered, so `""` can't match).
 */
export function isTrustedClient(clientId: string | undefined, env: OAuthEnv): boolean {
  return matchesAllowlist(clientId, env.OAUTH_TRUSTED_CLIENT_IDS);
}

/**
 * Returns true when `redirectUri` exactly matches an entry in the
 * OAUTH_TRUSTED_REDIRECT_URIS allowlist (comma-separated, surrounding
 * whitespace ignored). This is the durable agent-compat signal — the live
 * agent's first-party client rotates its client_id but keeps a stable
 * redirect_uri. Exact match only; an empty/absent allowlist or redirect_uri
 * is never trusted. Safe because the auth code is only delivered to the
 * redirect_uri, so a spoofed client_name cannot intercept it.
 */
export function isTrustedRedirectUri(redirectUri: string | undefined, env: OAuthEnv): boolean {
  return matchesAllowlist(redirectUri, env.OAUTH_TRUSTED_REDIRECT_URIS);
}

/** Exact-match membership against a comma-separated, whitespace-trimmed allowlist. */
function matchesAllowlist(value: string | undefined, rawAllowlist: string | undefined): boolean {
  if (!value || !rawAllowlist) return false;
  return rawAllowlist
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .includes(value);
}

/**
 * Completes an authorization request with the dogfood identity and the pinned
 * `['mcp']` scope, then returns the 302 back to the client's redirect_uri.
 *
 * The single auto-approve seam: the trusted short-circuit and the consent
 * "Approve" button both land here. `userId: 'limner-dogfood'` is where real
 * identity lands when human consumers come online; the `['mcp']` scope pin
 * (D-RA-19) stays regardless of what the client requested.
 */
export async function autoApprove(env: OAuthEnv, request: AuthRequest): Promise<Response> {
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request,
    userId: 'limner-dogfood',
    scope: ['mcp'],
    metadata: { dogfood: true, ts: Date.now() },
    props: {},
  });
  return Response.redirect(redirectTo, 302);
}

// --- CSRF token (stateless, HMAC-signed, no KV) -----------------------------

interface ConsentTokenPayload {
  v: 1;
  // The original parsed auth request, carried so the POST reconstructs it from
  // the signed payload instead of trusting loose form fields.
  req: AuthRequest;
  nonce: string;
  exp: number; // unix seconds
}

/**
 * Mint a signed consent token binding the auth request. `now` is injectable for
 * deterministic expiry in tests. Token format: `base64url(payload).base64url(sig)`.
 */
export async function signConsentToken(
  request: AuthRequest,
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const nonce = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
  const payload: ConsentTokenPayload = {
    v: 1,
    req: request,
    nonce,
    exp: Math.floor(now / 1000) + CONSENT_TOKEN_TTL_SECONDS,
  };
  const payloadB64 = base64UrlEncodeString(JSON.stringify(payload));
  const sig = await hmacSign(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

/**
 * Verify a consent token and return the embedded auth request, or null when the
 * token is malformed, has a bad/forged signature, or has expired. `now` is
 * injectable for tests.
 */
export async function verifyConsentToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<AuthRequest | null> {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSign(secret, payloadB64);
  if (!timingSafeEqual(sig, expected)) return null;

  let payload: ConsentTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64)) as ConsentTokenPayload;
  } catch {
    return null;
  }
  if (payload.v !== 1 || typeof payload.exp !== 'number') return null;
  if (payload.exp * 1000 < now) return null;
  const req = payload.req;
  if (!req || typeof req.clientId !== 'string' || typeof req.redirectUri !== 'string') {
    return null;
  }
  return req;
}

// --- Handlers ---------------------------------------------------------------

/**
 * GET /authorize. Trusted clients auto-approve; everyone else gets the consent
 * page with a freshly minted CSRF token. Fails closed (503) for non-trusted
 * clients when no signing key is configured.
 */
export async function handleAuthorize(req: Request, env: OAuthEnv): Promise<Response> {
  const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(req);

  // First-party clients auto-approve with no UI (agent-compat). Trust by the
  // STABLE redirect_uri (the agent's primary signal — its client_id rotates) or
  // by a pinned client_id. parseAuthRequest has already validated that
  // redirect_uri belongs to the client, so the code can only reach that URI.
  if (
    isTrustedClient(oauthReq.clientId, env) ||
    isTrustedRedirectUri(oauthReq.redirectUri, env)
  ) {
    return autoApprove(env, oauthReq);
  }

  const secret = env.OAUTH_CONSENT_SIGNING_KEY;
  if (!secret) {
    return new Response('consent signing not configured', { status: 503 });
  }

  const client = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId);
  const token = await signConsentToken(oauthReq, secret);
  const html = renderConsentPage({
    clientName: client?.clientName,
    clientId: oauthReq.clientId,
    csrfToken: token,
  });

  // The only request that carries this cookie is the same-site POST from the
  // consent form, so SameSite=Strict is correct (and closes the theoretical
  // login-CSRF window). The token alphabet is base64url + '.' — all cookie-safe
  // characters, so it needs no quoting; keep base64UrlEncode padding-stripped so
  // no '=' leaks into the value.
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'set-cookie': `${CSRF_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${CONSENT_TOKEN_TTL_SECONDS}`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy': CONSENT_CSP,
    },
  });
}

/**
 * POST /authorize. Validates the double-submit CSRF token, then either
 * completes the authorization (approve) or bounces back with access_denied
 * (deny). Fails closed (503) without a signing key; rejects CSRF failures (403)
 * and never open-redirects on deny (400 if the redirect_uri isn't registered).
 */
export async function handleAuthorizePost(req: Request, env: OAuthEnv): Promise<Response> {
  const secret = env.OAUTH_CONSENT_SIGNING_KEY;
  if (!secret) {
    return new Response('consent signing not configured', { status: 503 });
  }

  const body = new URLSearchParams(await req.text());
  const formToken = body.get('csrf_token');
  const action = body.get('action');
  const cookieToken = readCookie(req, CSRF_COOKIE);

  // Double-submit: the form token and the cookie token must both be present and
  // identical. A cross-site POST can forge neither the cookie nor the MAC.
  if (!formToken || !cookieToken || !timingSafeEqual(formToken, cookieToken)) {
    return new Response('invalid csrf token', { status: 403 });
  }

  const authReq = await verifyConsentToken(formToken, secret);
  if (!authReq) {
    return new Response('invalid csrf token', { status: 403 });
  }

  if (action === 'approve') {
    return autoApprove(env, authReq);
  }

  if (action === 'deny') {
    // Validate the redirect target against the client's registration before
    // redirecting — never open-redirect to a caller-supplied URL.
    const client = await env.OAUTH_PROVIDER.lookupClient(authReq.clientId);
    if (!client || !client.redirectUris.includes(authReq.redirectUri)) {
      return new Response('invalid redirect_uri', { status: 400 });
    }
    const location = new URL(authReq.redirectUri);
    location.searchParams.set('error', 'access_denied');
    if (authReq.state) location.searchParams.set('state', authReq.state);
    return new Response(null, { status: 302, headers: { location: location.toString() } });
  }

  return new Response('unknown action', { status: 400 });
}

// --- crypto + cookie helpers (mirrors r2.ts; see header note) ---------------

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

function base64UrlDecodeToString(value: string): string {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Constant-time string compare so token verification doesn't leak via
// early-exit timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

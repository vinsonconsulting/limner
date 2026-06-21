// D-RA-22 consent screen. The /authorize flow renders a real approve/deny
// consent page for non-trusted clients, protected by a stateless signed CSRF
// token (double-submit cookie + hidden field). Trusted first-party clients
// (the live CMA agent) still auto-approve without a screen. Scope stays pinned
// to ['mcp'] (D-RA-19) through the approve path.

import { describe, expect, test } from 'vitest';
import type { AuthRequest, ClientInfo } from '@cloudflare/workers-oauth-provider';

import {
  handleAuthorize,
  handleAuthorizePost,
  isTrustedRedirectUri,
  signConsentToken,
  type OAuthEnv,
} from '../src/auth/consent.js';
import { escapeHtml } from '../src/auth/consent-template.js';

const SECRET = 'test-consent-signing-key-0123456789';
const REDIRECT = 'https://client.example/cb';

type CompleteAuthArgs = { request: AuthRequest; userId: string; scope: string[] };

interface EnvOpts {
  signingKey?: string | undefined;
  trustedClientIds?: string;
  trustedRedirectUris?: string;
  client?: ClientInfo | null; // undefined => default registered client
}

function makeEnv(opts: EnvOpts = {}): {
  env: OAuthEnv;
  completeArgs: () => CompleteAuthArgs | undefined;
  lookups: () => string[];
} {
  let completeArgs: CompleteAuthArgs | undefined;
  const lookups: string[] = [];
  const defaultClient: ClientInfo = {
    clientId: 'client-x',
    clientName: 'Example Client',
    redirectUris: [REDIRECT],
    tokenEndpointAuthMethod: 'none',
  };
  const provider = {
    parseAuthRequest: async (req: Request): Promise<AuthRequest> => {
      const u = new URL(req.url);
      return {
        responseType: u.searchParams.get('response_type') ?? 'code',
        clientId: u.searchParams.get('client_id') ?? '',
        redirectUri: u.searchParams.get('redirect_uri') ?? REDIRECT,
        scope: (u.searchParams.get('scope') ?? '').split(' ').filter(Boolean),
        state: u.searchParams.get('state') ?? '',
        codeChallenge: u.searchParams.get('code_challenge') ?? undefined,
        codeChallengeMethod: u.searchParams.get('code_challenge_method') ?? undefined,
        resource: u.searchParams.get('resource') ?? undefined,
      };
    },
    completeAuthorization: async (args: CompleteAuthArgs) => {
      completeArgs = args;
      return { redirectTo: `${REDIRECT}?code=abc&state=${args.request.state}` };
    },
    lookupClient: async (clientId: string): Promise<ClientInfo | null> => {
      lookups.push(clientId);
      if (opts.client !== undefined) return opts.client;
      return defaultClient;
    },
  };
  const env = {
    OAUTH_PROVIDER: provider,
    OAUTH_CONSENT_SIGNING_KEY: 'signingKey' in opts ? opts.signingKey : SECRET,
    OAUTH_TRUSTED_CLIENT_IDS: opts.trustedClientIds,
    OAUTH_TRUSTED_REDIRECT_URIS: opts.trustedRedirectUris,
  } as unknown as OAuthEnv;
  return { env, completeArgs: () => completeArgs, lookups: () => lookups };
}

function getReq(query: string): Request {
  return new Request(`https://mcp.example.com/authorize?${query}`);
}

function postReq(fields: Record<string, string>, cookieToken?: string): Request {
  const body = new URLSearchParams(fields).toString();
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  };
  if (cookieToken !== undefined) headers['cookie'] = `__Host-limner_csrf=${cookieToken}`;
  return new Request('https://mcp.example.com/authorize', { method: 'POST', body, headers });
}

function authReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    responseType: 'code',
    clientId: 'client-x',
    redirectUri: REDIRECT,
    scope: ['admin'],
    state: 'xyz',
    ...overrides,
  };
}

function cookieFrom(res: Response): string | null {
  return res.headers.get('set-cookie');
}

describe('escapeHtml', () => {
  test('escapes the HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});

// The live agent's first-party "Claude" client rotates its client_id but keeps
// a stable redirect_uri, so agent-compat trusts the redirect_uri.
const CLAUDE_REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

describe('isTrustedRedirectUri — first-party allowlist by redirect_uri', () => {
  function envWith(trustedRedirectUris: string | undefined): OAuthEnv {
    return { OAUTH_TRUSTED_REDIRECT_URIS: trustedRedirectUris } as unknown as OAuthEnv;
  }

  test('returns false when the allowlist var is unset', () => {
    expect(isTrustedRedirectUri(CLAUDE_REDIRECT, envWith(undefined))).toBe(false);
  });

  test('returns false when the allowlist var is empty', () => {
    expect(isTrustedRedirectUri(CLAUDE_REDIRECT, envWith(''))).toBe(false);
  });

  test('matches an exact redirect_uri in a comma-separated list', () => {
    expect(
      isTrustedRedirectUri(CLAUDE_REDIRECT, envWith(`https://other.example/cb,${CLAUDE_REDIRECT}`)),
    ).toBe(true);
  });

  test('trims surrounding whitespace around each entry', () => {
    expect(isTrustedRedirectUri(CLAUDE_REDIRECT, envWith(`  ${CLAUDE_REDIRECT}  `))).toBe(true);
  });

  test('requires an exact match (no prefix/substring bypass)', () => {
    expect(isTrustedRedirectUri('https://claude.ai/api/mcp/auth_callback.evil.com', envWith(CLAUDE_REDIRECT))).toBe(false);
    expect(isTrustedRedirectUri('https://claude.ai/api', envWith(CLAUDE_REDIRECT))).toBe(false);
  });

  test('never trusts an empty/undefined redirect_uri', () => {
    expect(isTrustedRedirectUri('', envWith(CLAUDE_REDIRECT))).toBe(false);
    expect(isTrustedRedirectUri(undefined, envWith(CLAUDE_REDIRECT))).toBe(false);
  });
});

describe('GET /authorize — trusted redirect_uri auto-approve (agent-compat)', () => {
  test('auto-approves a client with a trusted redirect_uri even though its client_id is not allowlisted', async () => {
    const { env, completeArgs } = makeEnv({ trustedRedirectUris: CLAUDE_REDIRECT });
    const res = await handleAuthorize(
      getReq(
        `response_type=code&client_id=rotating-claude-id&scope=admin&redirect_uri=${encodeURIComponent(CLAUDE_REDIRECT)}`,
      ),
      env,
    );
    expect(res.status).toBe(302); // no consent screen
    expect(completeArgs()?.scope).toEqual(['mcp']);
    expect(completeArgs()?.userId).toBe('limner-dogfood');
    expect(cookieFrom(res)).toBeNull(); // no CSRF cookie on the trusted path
  });

  test('still renders consent when neither client_id nor redirect_uri is trusted', async () => {
    const { env, completeArgs } = makeEnv({ trustedRedirectUris: CLAUDE_REDIRECT });
    const res = await handleAuthorize(
      getReq('response_type=code&client_id=client-x&scope=admin&redirect_uri=' + encodeURIComponent(REDIRECT)),
      env,
    );
    expect(res.status).toBe(200);
    expect((await res.text())).toContain('name="csrf_token"');
    expect(completeArgs()).toBeUndefined();
  });

  test('trusted redirect_uri auto-approves without needing the consent signing key', async () => {
    const { env, completeArgs } = makeEnv({
      trustedRedirectUris: CLAUDE_REDIRECT,
      signingKey: undefined,
    });
    const res = await handleAuthorize(
      getReq(`response_type=code&client_id=x&redirect_uri=${encodeURIComponent(CLAUDE_REDIRECT)}`),
      env,
    );
    expect(res.status).toBe(302);
    expect(completeArgs()?.scope).toEqual(['mcp']);
  });
});

describe('GET /authorize — consent rendering', () => {
  test('renders the consent page for an untrusted client', async () => {
    const { env } = makeEnv();
    const res = await handleAuthorize(
      getReq('response_type=code&client_id=client-x&scope=admin&state=xyz'),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Example Client');
    expect(html).toContain('mcp');
    expect(html).toContain('name="csrf_token"');
    expect(html).toContain('value="approve"');
    expect(html).toContain('value="deny"');
    // Security headers + CSRF cookie present.
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    const cookie = cookieFrom(res);
    expect(cookie).toContain('__Host-limner_csrf=');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  test('falls back gracefully when the client is unregistered (lookup null)', async () => {
    const { env } = makeEnv({ client: null });
    const res = await handleAuthorize(
      getReq('response_type=code&client_id=ghost&scope=admin'),
      env,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('ghost'); // raw client id shown as fallback
    expect(html).toContain('name="csrf_token"');
  });

  test('escapes a hostile client name (XSS guard)', async () => {
    const evil: ClientInfo = {
      clientId: 'client-x',
      clientName: '"><script>alert(1)</script>',
      redirectUris: [REDIRECT],
      tokenEndpointAuthMethod: 'none',
    };
    const { env } = makeEnv({ client: evil });
    const res = await handleAuthorize(getReq('response_type=code&client_id=client-x'), env);
    const html = await res.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('auto-approves a trusted client with no consent screen', async () => {
    const { env, completeArgs } = makeEnv({ trustedClientIds: 'agent-client' });
    const res = await handleAuthorize(
      getReq('response_type=code&client_id=agent-client&scope=admin'),
      env,
    );
    expect(res.status).toBe(302);
    expect(completeArgs()?.scope).toEqual(['mcp']);
    expect(cookieFrom(res)).toBeNull(); // no CSRF cookie on the agent path
  });

  test('a trusted client auto-approves even with no signing key configured', async () => {
    const { env, completeArgs } = makeEnv({
      trustedClientIds: 'agent-client',
      signingKey: undefined,
    });
    const res = await handleAuthorize(
      getReq('response_type=code&client_id=agent-client'),
      env,
    );
    expect(res.status).toBe(302);
    expect(completeArgs()?.scope).toEqual(['mcp']);
  });

  test('fails closed for a non-trusted client when no signing key is configured', async () => {
    const { env, completeArgs } = makeEnv({ signingKey: undefined });
    const res = await handleAuthorize(getReq('response_type=code&client_id=client-x'), env);
    expect(res.status).toBe(503);
    expect(completeArgs()).toBeUndefined();
  });
});

describe('POST /authorize — approve', () => {
  test('issues a grant with the scope pinned to ["mcp"]', async () => {
    const { env, completeArgs } = makeEnv();
    const token = await signConsentToken(authReq({ scope: ['admin', 'everything'] }), SECRET);
    const res = await handleAuthorizePost(
      postReq({ csrf_token: token, action: 'approve' }, token),
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('code=abc');
    expect(completeArgs()?.scope).toEqual(['mcp']);
    expect(completeArgs()?.userId).toBe('limner-dogfood');
  });

  test('pins scope to ["mcp"] even when the original request had no scope', async () => {
    const { env, completeArgs } = makeEnv();
    const token = await signConsentToken(authReq({ scope: [] }), SECRET);
    const res = await handleAuthorizePost(
      postReq({ csrf_token: token, action: 'approve' }, token),
      env,
    );
    expect(res.status).toBe(302);
    expect(completeArgs()?.scope).toEqual(['mcp']);
  });

  test('preserves PKCE + state when reconstructing the request from the token', async () => {
    const { env, completeArgs } = makeEnv();
    const token = await signConsentToken(
      authReq({ codeChallenge: 'chal', codeChallengeMethod: 'S256', state: 'st-1' }),
      SECRET,
    );
    await handleAuthorizePost(postReq({ csrf_token: token, action: 'approve' }, token), env);
    expect(completeArgs()?.request.codeChallenge).toBe('chal');
    expect(completeArgs()?.request.codeChallengeMethod).toBe('S256');
    expect(completeArgs()?.request.state).toBe('st-1');
  });
});

describe('POST /authorize — deny', () => {
  test('redirects to the client redirect_uri with error=access_denied', async () => {
    const { env, completeArgs } = makeEnv();
    const token = await signConsentToken(authReq({ state: 'st-9' }), SECRET);
    const res = await handleAuthorizePost(
      postReq({ csrf_token: token, action: 'deny' }, token),
      env,
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('error=access_denied');
    expect(loc).toContain('state=st-9');
    expect(completeArgs()).toBeUndefined(); // no grant issued on deny
  });

  test('never open-redirects: rejects a redirect_uri not registered to the client', async () => {
    const { env } = makeEnv();
    const token = await signConsentToken(
      authReq({ redirectUri: 'https://evil.example/steal' }),
      SECRET,
    );
    const res = await handleAuthorizePost(
      postReq({ csrf_token: token, action: 'deny' }, token),
      env,
    );
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });

  test('rejects deny when the client lookup returns null', async () => {
    const { env } = makeEnv({ client: null });
    const token = await signConsentToken(authReq(), SECRET);
    const res = await handleAuthorizePost(
      postReq({ csrf_token: token, action: 'deny' }, token),
      env,
    );
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('POST /authorize — CSRF + fail-closed', () => {
  test('rejects a request with no CSRF token at all', async () => {
    const { env, completeArgs } = makeEnv();
    const res = await handleAuthorizePost(postReq({ action: 'approve' }), env);
    expect(res.status).toBe(403);
    expect(completeArgs()).toBeUndefined();
  });

  test('rejects when the cookie token is missing (double-submit half present)', async () => {
    const { env } = makeEnv();
    const token = await signConsentToken(authReq(), SECRET);
    const res = await handleAuthorizePost(postReq({ csrf_token: token, action: 'approve' }), env);
    expect(res.status).toBe(403);
  });

  test('rejects when the form token and cookie token differ', async () => {
    const { env } = makeEnv();
    const tokenA = await signConsentToken(authReq(), SECRET);
    const tokenB = await signConsentToken(authReq(), SECRET);
    const res = await handleAuthorizePost(
      postReq({ csrf_token: tokenA, action: 'approve' }, tokenB),
      env,
    );
    expect(res.status).toBe(403);
  });

  test('rejects a token with a tampered signature', async () => {
    const { env } = makeEnv();
    const token = await signConsentToken(authReq(), SECRET);
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    const res = await handleAuthorizePost(
      postReq({ csrf_token: tampered, action: 'approve' }, tampered),
      env,
    );
    expect(res.status).toBe(403);
  });

  test('rejects a token signed with the wrong secret', async () => {
    const { env } = makeEnv();
    const token = await signConsentToken(authReq(), 'a-different-secret');
    const res = await handleAuthorizePost(
      postReq({ csrf_token: token, action: 'approve' }, token),
      env,
    );
    expect(res.status).toBe(403);
  });

  test('rejects an expired token', async () => {
    const { env } = makeEnv();
    // Mint with a now ~700s in the past so the 10-min TTL has lapsed.
    const token = await signConsentToken(authReq(), SECRET, Date.now() - 700_000);
    const res = await handleAuthorizePost(
      postReq({ csrf_token: token, action: 'approve' }, token),
      env,
    );
    expect(res.status).toBe(403);
  });

  test('fails closed when no signing key is configured', async () => {
    const { env, completeArgs } = makeEnv({ signingKey: undefined });
    const token = await signConsentToken(authReq(), SECRET);
    const res = await handleAuthorizePost(
      postReq({ csrf_token: token, action: 'approve' }, token),
      env,
    );
    expect(res.status).toBe(503);
    expect(completeArgs()).toBeUndefined();
  });

  test('rejects an unknown action', async () => {
    const { env, completeArgs } = makeEnv();
    const token = await signConsentToken(authReq(), SECRET);
    const res = await handleAuthorizePost(
      postReq({ csrf_token: token, action: 'sideways' }, token),
      env,
    );
    expect(res.status).toBe(400);
    expect(completeArgs()).toBeUndefined();
  });
});

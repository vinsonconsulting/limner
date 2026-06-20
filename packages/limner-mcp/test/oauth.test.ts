// D-RA-22: the /authorize flow routes through the consent handlers. This suite
// covers the router (defaultHandler) wiring + the first-party allowlist;
// the consent page, CSRF, approve/deny, and the ['mcp'] scope pin live in
// consent.test.ts.

import { describe, expect, test } from 'vitest';

import { defaultHandler, isTrustedClient, type OAuthEnv } from '../src/auth/oauth.js';

type Fetch = NonNullable<typeof defaultHandler.fetch>;
type CompleteAuthArgs = { userId: string; scope: string[] };

// Build an OAuthEnv whose OAUTH_PROVIDER records the completeAuthorization
// args. No signing key is set, so non-trusted /authorize requests fail closed —
// which is exactly what the router-level tests assert (delegation happened).
function makeEnv(opts?: { clientId?: string; trustedClientIds?: string }): {
  env: OAuthEnv;
  captured: () => CompleteAuthArgs | undefined;
} {
  let captured: CompleteAuthArgs | undefined;
  const provider = {
    parseAuthRequest: async () => ({ scope: ['admin'], clientId: opts?.clientId }),
    completeAuthorization: async (args: CompleteAuthArgs) => {
      captured = args;
      return { redirectTo: 'https://client.example/cb?code=abc' };
    },
  };
  const env = { OAUTH_PROVIDER: provider } as unknown as OAuthEnv;
  if (opts?.trustedClientIds !== undefined) {
    (env as { OAUTH_TRUSTED_CLIENT_IDS?: string }).OAUTH_TRUSTED_CLIENT_IDS =
      opts.trustedClientIds;
  }
  return { env, captured: () => captured };
}

const CTX = {} as Parameters<Fetch>[2];

function send(env: OAuthEnv, url: string, init?: RequestInit): Promise<Response> {
  const req = new Request(url, init) as unknown as Parameters<Fetch>[0];
  return defaultHandler.fetch!(req, env, CTX) as unknown as Promise<Response>;
}

describe('isTrustedClient — first-party allowlist (agent-compat)', () => {
  function envWith(trustedClientIds: string | undefined): OAuthEnv {
    return { OAUTH_TRUSTED_CLIENT_IDS: trustedClientIds } as unknown as OAuthEnv;
  }

  test('returns false when the allowlist var is unset', () => {
    expect(isTrustedClient('client-a', envWith(undefined))).toBe(false);
  });

  test('returns false when the allowlist var is empty', () => {
    expect(isTrustedClient('client-a', envWith(''))).toBe(false);
  });

  test('matches a client id present in a comma-separated list', () => {
    expect(isTrustedClient('client-b', envWith('client-a,client-b,client-c'))).toBe(true);
  });

  test('trims surrounding whitespace around each entry', () => {
    expect(isTrustedClient('client-b', envWith('client-a, client-b , client-c'))).toBe(true);
  });

  test('returns false for a client id absent from the list', () => {
    expect(isTrustedClient('client-d', envWith('client-a,client-b'))).toBe(false);
  });

  test('never treats an empty client id as trusted, even with blank list entries', () => {
    expect(isTrustedClient('', envWith('client-a,,client-b'))).toBe(false);
    expect(isTrustedClient(undefined, envWith('client-a,client-b'))).toBe(false);
  });
});

describe('OAuth /authorize — router (defaultHandler)', () => {
  test('auto-approves a trusted client with the pinned ["mcp"] scope', async () => {
    const { env, captured } = makeEnv({
      clientId: 'agent-client',
      trustedClientIds: 'agent-client',
    });
    const res = await send(
      env,
      'https://mcp.example.com/authorize?response_type=code&client_id=agent-client&scope=admin',
    );
    expect(res.status).toBe(302);
    expect(captured()?.scope).toEqual(['mcp']);
    expect(captured()?.userId).toBe('limner-dogfood');
  });

  test('delegates a non-trusted GET to consent (fails closed without a signing key)', async () => {
    const { env, captured } = makeEnv({
      clientId: 'random-client',
      trustedClientIds: 'agent-client',
    });
    const res = await send(
      env,
      'https://mcp.example.com/authorize?response_type=code&client_id=random-client&scope=admin',
    );
    expect(res.status).toBe(503);
    expect(captured()).toBeUndefined(); // not auto-approved
  });

  test('routes POST /authorize to the consent POST handler', async () => {
    const { env, captured } = makeEnv({ clientId: 'random-client' });
    const res = await send(env, 'https://mcp.example.com/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'action=approve',
    });
    // No signing key configured → the POST handler fails closed (503), proving
    // the router dispatched the POST branch rather than rendering a page.
    expect(res.status).toBe(503);
    expect(captured()).toBeUndefined();
  });

  test('serves a plain-text root page rather than 404', async () => {
    const { env } = makeEnv();
    const res = await send(env, 'https://mcp.example.com/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  test('returns 404 for an unknown path', async () => {
    const { env } = makeEnv();
    const res = await send(env, 'https://mcp.example.com/nope');
    expect(res.status).toBe(404);
  });
});

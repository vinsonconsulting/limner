// A1 mechanical hardening: the dogfood /authorize handler still auto-approves,
// but the issued scope is PINNED to ['mcp'] regardless of what the client
// requests — so a client cannot mint a broader-scoped token. (The /authorize
// rate-limit lives in the worker wiring and is covered by rate-limit.test.ts.)

import { describe, expect, test } from 'vitest';

import { defaultHandler, isTrustedClient, type OAuthEnv } from '../src/auth/oauth.js';

type Fetch = NonNullable<typeof defaultHandler.fetch>;
type CompleteAuthArgs = { userId: string; scope: string[] };

// Build an OAuthEnv whose OAUTH_PROVIDER records the completeAuthorization
// args and reports whatever scope (and optional clientId) the "client"
// requested. `opts.trustedClientIds` seeds the OAUTH_TRUSTED_CLIENT_IDS var.
function makeEnv(
  requestedScope: string[] | undefined,
  opts?: { clientId?: string; trustedClientIds?: string },
): {
  env: OAuthEnv;
  captured: () => CompleteAuthArgs | undefined;
} {
  let captured: CompleteAuthArgs | undefined;
  const provider = {
    parseAuthRequest: async () => ({ scope: requestedScope, clientId: opts?.clientId }),
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
  return {
    env,
    captured: () => captured,
  };
}

const CTX = {} as Parameters<Fetch>[2];

function authorize(env: OAuthEnv, url: string): Promise<Response> {
  const req = new Request(url) as unknown as Parameters<Fetch>[0];
  return defaultHandler.fetch!(req, env, CTX) as unknown as Promise<Response>;
}

describe('OAuth /authorize — mechanical hardening (A1)', () => {
  test('pins the issued scope to ["mcp"], ignoring the client-requested scope', async () => {
    const { env, captured } = makeEnv(['admin', 'everything']);
    const res = await authorize(
      env,
      'https://mcp.example.com/authorize?response_type=code&client_id=c&scope=admin',
    );
    expect(res.status).toBe(302);
    expect(captured()?.scope).toEqual(['mcp']);
    expect(captured()?.userId).toBe('limner-dogfood');
  });

  test('pins scope to ["mcp"] even when the client requests no scope', async () => {
    const { env, captured } = makeEnv(undefined);
    const res = await authorize(
      env,
      'https://mcp.example.com/authorize?response_type=code&client_id=c',
    );
    expect(res.status).toBe(302);
    expect(captured()?.scope).toEqual(['mcp']);
  });

  test('serves a plain-text root page rather than 404', async () => {
    const { env } = makeEnv(undefined);
    const res = await authorize(env, 'https://mcp.example.com/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });
});

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

describe('OAuth /authorize — trusted-client short-circuit (agent-compat)', () => {
  // In this PR every client still auto-approves; the trusted path is split out
  // so the live agent's compatibility is guaranteed before the consent screen
  // changes the behavior of non-trusted clients in the next PR.
  test('auto-approves a trusted client with the pinned ["mcp"] scope', async () => {
    const { env, captured } = makeEnv(['admin'], {
      clientId: 'agent-client',
      trustedClientIds: 'agent-client',
    });
    const res = await authorize(
      env,
      'https://mcp.example.com/authorize?response_type=code&client_id=agent-client&scope=admin',
    );
    expect(res.status).toBe(302);
    expect(captured()?.scope).toEqual(['mcp']);
    expect(captured()?.userId).toBe('limner-dogfood');
  });

  test('still auto-approves a non-trusted client (unchanged dogfood behavior)', async () => {
    const { env, captured } = makeEnv(['admin'], {
      clientId: 'random-client',
      trustedClientIds: 'agent-client',
    });
    const res = await authorize(
      env,
      'https://mcp.example.com/authorize?response_type=code&client_id=random-client&scope=admin',
    );
    expect(res.status).toBe(302);
    expect(captured()?.scope).toEqual(['mcp']);
  });
});

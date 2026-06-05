// A1 mechanical hardening: the dogfood /authorize handler still auto-approves,
// but the issued scope is PINNED to ['mcp'] regardless of what the client
// requests — so a client cannot mint a broader-scoped token. (The /authorize
// rate-limit lives in the worker wiring and is covered by rate-limit.test.ts.)

import { describe, expect, test } from 'vitest';

import { defaultHandler, type OAuthEnv } from '../src/auth/oauth.js';

type Fetch = NonNullable<typeof defaultHandler.fetch>;
type CompleteAuthArgs = { userId: string; scope: string[] };

// Build an OAuthEnv whose OAUTH_PROVIDER records the completeAuthorization
// args and reports whatever scope the "client" requested.
function makeEnv(requestedScope: string[] | undefined): {
  env: OAuthEnv;
  captured: () => CompleteAuthArgs | undefined;
} {
  let captured: CompleteAuthArgs | undefined;
  const provider = {
    parseAuthRequest: async () => ({ scope: requestedScope }),
    completeAuthorization: async (args: CompleteAuthArgs) => {
      captured = args;
      return { redirectTo: 'https://client.example/cb?code=abc' };
    },
  };
  return {
    env: { OAUTH_PROVIDER: provider } as unknown as OAuthEnv,
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
      'https://mcp.limner.us/authorize?response_type=code&client_id=c&scope=admin',
    );
    expect(res.status).toBe(302);
    expect(captured()?.scope).toEqual(['mcp']);
    expect(captured()?.userId).toBe('limner-dogfood');
  });

  test('pins scope to ["mcp"] even when the client requests no scope', async () => {
    const { env, captured } = makeEnv(undefined);
    const res = await authorize(
      env,
      'https://mcp.limner.us/authorize?response_type=code&client_id=c',
    );
    expect(res.status).toBe(302);
    expect(captured()?.scope).toEqual(['mcp']);
  });

  test('serves a plain-text root page rather than 404', async () => {
    const { env } = makeEnv(undefined);
    const res = await authorize(env, 'https://mcp.limner.us/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });
});

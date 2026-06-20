// OAuth 2.1 wiring via @cloudflare/workers-oauth-provider.
//
// Per D-RA-06: public OAuth on Workers, dynamic client registration
// (RFC 7591). Token storage in env.OAUTH_KV (created in Step 7).
//
// Dogfood window (D-RA-12): the /authorize page auto-approves any
// authenticated client without surfacing a UI. The CMA agent itself
// hits Path B in v1; an explicit consent screen lands when external
// human consumers come online (post-dogfood) — decided as D-RA-22
// (2026-06-05): the public auth gate is an OAuth consent screen
// landing in v1.0.x, superseding the API-key alternative.
//
// Refs: D-RA-06, D-RA-12, D-RA-22

import type { ExportedHandler } from '@cloudflare/workers-types';
import type { AuthRequest, OAuthHelpers } from '@cloudflare/workers-oauth-provider';

// The OAuth provider injects an OAuthHelpers instance under
// env.OAUTH_PROVIDER. Both the apiHandler and defaultHandler see it.
export interface OAuthEnv {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: import('@cloudflare/workers-types').KVNamespace;
  // Comma-separated allowlist of first-party OAuth client_ids that bypass the
  // consent UI and auto-approve (agent-compat). The live CMA agent's
  // DCR-issued client_id goes here so a fresh re-authorization never has to
  // clear a human consent screen. Plain var (a client_id is public, A4-safe
  // to commit); absent/empty means no client is trusted. See D-RA-22.
  OAUTH_TRUSTED_CLIENT_IDS?: string;
}

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
  if (!clientId) return false;
  const raw = env.OAUTH_TRUSTED_CLIENT_IDS;
  if (!raw) return false;
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .includes(clientId);
}

/**
 * Completes an authorization request with the dogfood identity and the pinned
 * `['mcp']` scope, then returns the 302 back to the client's redirect_uri.
 *
 * This is the single auto-approve seam. Today both the trusted and non-trusted
 * branches call it; the next PR (D-RA-22) keeps the trusted branch on this path
 * while routing non-trusted clients through the consent screen instead. The
 * `userId: 'limner-dogfood'` placeholder is where real identity lands when
 * human consumers come online; the `['mcp']` scope pin (D-RA-19) stays regardless.
 */
async function autoApprove(env: OAuthEnv, request: AuthRequest): Promise<Response> {
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request,
    userId: 'limner-dogfood',
    scope: ['mcp'],
    metadata: { dogfood: true, ts: Date.now() },
    props: {},
  });
  return Response.redirect(redirectTo, 302);
}

/**
 * Default handler — receives non-API requests including the
 * `/authorize` flow. In the v1 dogfood configuration this is a
 * trivial auto-approve: any caller is immediately granted the fixed
 * `['mcp']` scope (NOT whatever it requested) and bounced back to the
 * redirect_uri with the auth code.
 *
 * When external human consumers come online (post-dogfood), this
 * handler grows a real consent screen and authentication step
 * (D-RA-22: OAuth consent screen, v1.0.x).
 */
export const defaultHandler: ExportedHandler<OAuthEnv> = {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === '/authorize') {
      // Parse the inbound authorization request. The issued scope is PINNED to
      // ['mcp'] (D-RA-19) — we ignore whatever the client requested, so a
      // client cannot mint a broader-scoped token. This endpoint is
      // rate-limited at the worker wiring (withRateLimit on defaultHandler).
      const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(req);

      // Trusted first-party clients (the live CMA agent) auto-approve without a
      // consent UI — this guards their auth against the consent screen that
      // lands for everyone else in v1.0.x (D-RA-22). In THIS PR the consent
      // screen does not exist yet, so non-trusted clients also auto-approve
      // (unchanged dogfood posture); splitting the trusted path out now lets
      // the next PR change only the non-trusted branch.
      if (isTrustedClient(oauthReq.clientId, env)) {
        return autoApprove(env, oauthReq);
      }

      return autoApprove(env, oauthReq);
    }

    if (url.pathname === '/' || url.pathname === '') {
      // Minimal root page so wrangler dev doesn't 404 on the index.
      return new Response(
        'limner-mcp — MCP server. POST JSON-RPC to /mcp with a valid OAuth Bearer token. See /.well-known/oauth-authorization-server for OAuth metadata.',
        { headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }

    return new Response('not found', { status: 404 });
  },
};

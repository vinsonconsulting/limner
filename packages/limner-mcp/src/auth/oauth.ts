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
import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';

// The OAuth provider injects an OAuthHelpers instance under
// env.OAUTH_PROVIDER. Both the apiHandler and defaultHandler see it.
export interface OAuthEnv {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: import('@cloudflare/workers-types').KVNamespace;
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
      // Parse the inbound authorization request, then complete it
      // immediately with a dogfood user identity. The issued scope is
      // PINNED to ['mcp'] (D-RA-19) — we ignore whatever the client
      // requested, so a client cannot mint a broader-scoped token even
      // while the dogfood build still auto-approves. A real consent step
      // (and per-client scope policy) lands in v1.0.x per D-RA-22. This
      // endpoint is rate-limited at the worker wiring (withRateLimit on
      // defaultHandler).
      const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(req);
      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthReq,
        userId: 'limner-dogfood',
        scope: ['mcp'],
        metadata: { dogfood: true, ts: Date.now() },
        props: {},
      });
      return Response.redirect(redirectTo, 302);
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

// OAuth 2.1 wiring via @cloudflare/workers-oauth-provider.
//
// Per D-RA-06: public OAuth on Workers, dynamic client registration
// (RFC 7591). Token storage in env.OAUTH_KV (created in Step 7).
//
// D-RA-22 (2026-06-05): the public auth gate is an OAuth consent screen. The
// `/authorize` flow now routes to the consent handlers (auth/consent.ts):
// trusted first-party clients (OAUTH_TRUSTED_CLIENT_IDS — e.g. the live CMA
// agent) auto-approve with no UI; everyone else gets a real approve/deny page
// protected by a signed CSRF token. The issued scope stays pinned to ['mcp']
// (D-RA-19). Token refresh and bearer validation are owned by the
// OAuthProvider itself and never pass through this handler.
//
// Refs: D-RA-06, D-RA-12, D-RA-19, D-RA-22

import type { ExportedHandler } from '@cloudflare/workers-types';

import { handleAuthorize, handleAuthorizePost } from './consent.js';

// OAuthEnv + the trusted-client helper live in consent.ts (the auth surface);
// re-exported here so existing importers (worker wiring, tests) are unchanged.
export type { OAuthEnv } from './consent.js';
export { isTrustedClient } from './consent.js';

import type { OAuthEnv } from './consent.js';

/**
 * Default handler — receives non-API requests including the `/authorize` flow.
 * `/authorize` is delegated to the consent handlers (auth/consent.ts); GET
 * renders consent (or auto-approves trusted clients), POST handles approve/deny.
 * The root page keeps wrangler dev from 404-ing on the index.
 *
 * This handler is rate-limited at the worker wiring (withRateLimit wraps the
 * whole handler in worker.ts), so both GET and POST /authorize are metered.
 */
export const defaultHandler: ExportedHandler<OAuthEnv> = {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === '/authorize') {
      return req.method === 'POST' ? handleAuthorizePost(req, env) : handleAuthorize(req, env);
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

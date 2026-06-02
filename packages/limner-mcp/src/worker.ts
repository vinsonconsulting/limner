// Workers entry point. The default export is an OAuthProvider that
// wraps the MCP handler under apiRoute=/mcp and routes everything
// else to the defaultHandler (auto-approve /authorize + a stub root
// page). The OAuthProvider implements /oauth/token, /oauth/register,
// /.well-known/oauth-authorization-server itself.
//
// Refs: D-RA-05, D-RA-06, D-RA-12

import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type {
  D1Database,
  ExportedHandler,
  ImagesBinding,
  KVNamespace,
} from '@cloudflare/workers-types';
import type { Bindings, CFImagesBinding } from '@limner/core';

import { createServer, registerTools, type ToolContext } from './server.js';
import { pipelineTools } from './tools/pipelines.js';
import { composeTool } from './tools/compose.js';
import { memoryTools } from './tools/memory.js';
import { projectTools } from './tools/context.js';
import { metaTools } from './tools/meta.js';
import { defaultHandler } from './auth/oauth.js';

export interface Env {
  // D1 — durable state (memory + projects + sessions per D-RA-04).
  DB: D1Database;
  // KV — required by workers-oauth-provider; binding name is mandated.
  OAUTH_KV: KVNamespace;
  // Cloudflare Images Transformations binding. Optional at the type
  // level so the worker still boots in accounts/zones without Images
  // enabled — compose's cf-* ops self-report unsupported when missing.
  IMAGES?: ImagesBinding;
  // Pipeline credentials (Cloudflare Secrets). Injected at deploy time
  // via `wrangler secret put`. Absent values surface as
  // missing_credential errors from the pipeline runners.
  OPENAI_API_KEY?: string;
  RECRAFT_API_KEY?: string;
  // OAuthProvider injects this at runtime; declared here for the
  // apiHandler's type signature.
  OAUTH_PROVIDER: OAuthHelpers;
}

function buildWorkersBindings(env: Env): Bindings {
  return {
    kind: 'workers',
    DB: env.DB,
  } as Bindings;
}

function buildSecrets(env: Env): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  if (env.OPENAI_API_KEY) out['OPENAI_API_KEY'] = env.OPENAI_API_KEY;
  if (env.RECRAFT_API_KEY) out['RECRAFT_API_KEY'] = env.RECRAFT_API_KEY;
  return out;
}

// MCP handler — wrapped by OAuthProvider below. By the time this
// runs, OAuthProvider has already validated the access token (any
// request hitting /mcp without a valid Bearer is rejected upstream).
//
// Per-request Server + Transport with a FIXED session id is the
// pattern that works for Anthropic's Managed Agents client. Module-
// scope caching causes stale-session bugs across Anthropic sessions
// (each MA session creates a new MCP session; cached Transport state
// from a prior MA session rejects new initialize calls). Per-request
// construction with a fixed `sessionIdGenerator` sidesteps both:
// every new Transport instance generates the same id, so any incoming
// `Mcp-Session-Id` matches what the new Transport would emit, and
// Anthropic's outer session correlation works regardless of which
// isolate processes the request.
//
// tools/list still returns HTTP 400 in this configuration (the SDK's
// Transport appears to require state established within the same
// instance for tools/list specifically) — but Anthropic gracefully
// degrades via a `session.error: mcp_connection_failed_error` event
// and continues the session. Tool schemas are inferred from the agent
// definition's `mcp_servers` array, so tools/call still routes.
const apiHandler = {
  async fetch(req, env) {
    const server = createServer('limner-mcp', '0.0.1');
    registerTools(
      server,
      [...pipelineTools, composeTool, ...memoryTools, ...projectTools, ...metaTools],
      (): ToolContext => ({
        bindings: buildWorkersBindings(env),
        images: env.IMAGES as unknown as CFImagesBinding | undefined,
        secrets: buildSecrets(env),
      }),
    );

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => 'limner-mcp-session',
    });
    await server.connect(transport);

    return (await transport.handleRequest(
      req as unknown as globalThis.Request,
    )) as unknown as Response;
  },
} satisfies ExportedHandler<Env>;

// The OAuthProvider wraps everything. apiHandler is invoked only for
// requests that pass the token check; defaultHandler sees everything
// else (including the /authorize flow).
export default new OAuthProvider<Env>({
  apiRoute: '/mcp',
  apiHandler,
  // The defaultHandler is typed against OAuthEnv (a narrow subset),
  // which is structurally a subset of our Env, so the OAuth provider
  // accepts it; cast to satisfy nominal type identity.
  defaultHandler: defaultHandler as unknown as ExportedHandler<Env>,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  clientRegistrationEndpoint: '/oauth/register',
  scopesSupported: ['mcp'],
});

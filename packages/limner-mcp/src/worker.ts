// Workers entry point. The default export is an OAuthProvider that
// wraps the LimnerMCP DurableObject under apiRoute=/mcp and routes
// everything else to the defaultHandler (auto-approve /authorize + a
// stub root page). The OAuthProvider implements /oauth/token,
// /oauth/register, /.well-known/oauth-authorization-server itself.
//
// Phase 6c (2026-06-01): LimnerMCP extends McpAgent (DO-backed stateful
// MCP). The session-id correlation that the SDK's
// StreamableHTTPServerTransport requires across the
// initialize → notifications/initialized → tools/list → tools/call
// chain is delivered by routing on Mcp-Session-Id to a persistent DO
// instance per session.
//
// Historical (Phase 6b, kept in git blame at commit 206f07c):
// per-request Server+Transport with a fixed sessionIdGenerator was a
// workaround for Anthropic Managed Agents' model_request_failed_error.
// That unblocked the model but left tools/list returning HTTP 400
// because the SDK's Transport keeps dispatch state on the instance.
// Replaced wholesale in 6c.
//
// Refs: D-RA-05, D-RA-06, D-RA-12

import { McpAgent } from 'agents/mcp';
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import type {
  D1Database,
  DurableObjectNamespace,
  ExportedHandler,
  ImagesBinding,
  KVNamespace,
  RateLimit,
  R2Bucket,
} from '@cloudflare/workers-types';
import type { Bindings, CFImagesBinding } from '@limner/core';

import { createServer, registerTools, type ToolContext } from './server.js';
import { VERSION } from './version.js';
import { initComposeWasmWorkers } from './wasm-init.js';
import { pipelineTools } from './tools/pipelines.js';
import { composeTool } from './tools/compose.js';
import { memoryTools } from './tools/memory.js';
import { projectTools } from './tools/context.js';
import { metaTools } from './tools/meta.js';
import { resources, registerResources } from './resources/index.js';
import { prompts, registerPrompts } from './prompts/index.js';
import { defaultHandler } from './auth/oauth.js';
import { withRateLimit, type FetchHandler } from './rate-limit.js';
import { sweepExpiredArtifacts } from './retention.js';

export interface Env {
  // D1 — durable state (memory + projects + sessions per D-RA-04).
  DB: D1Database;
  // KV — required by workers-oauth-provider; binding name is mandated.
  OAUTH_KV: KVNamespace;
  // Phase 6c — Durable Object namespace backing LimnerMCP. One DO
  // instance per Mcp-Session-Id. Class registered via wrangler.toml
  // migration tag v1.
  LIMNER_MCP: DurableObjectNamespace;
  // Cloudflare Images Transformations binding. Optional at the type
  // level so the worker still boots in accounts/zones without Images
  // enabled — compose's cf-* ops self-report unsupported when missing.
  IMAGES?: ImagesBinding;
  // Pipeline credentials (Cloudflare Secrets). Injected at deploy time
  // via `wrangler secret put`. Absent values surface as
  // missing_credential errors from the pipeline runners.
  OPENAI_API_KEY?: string;
  RECRAFT_API_KEY?: string;
  // RT-1 — Workers Rate Limiting binding (`[[ratelimits]]` in
  // wrangler.toml). Optional so stdio/local/tests boot without it;
  // withRateLimit() fails open when absent.
  RATE_LIMITER?: RateLimit;
  // RT-2 (D-RA-20) — R2 bucket for image artifacts. Optional so local/tests
  // boot without it; the scheduled() retention sweep no-ops when absent.
  BUCKET?: R2Bucket;
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

// LimnerMCP — DO-backed MCP server. McpAgent's `server` abstract field
// accepts the low-level Server (from @modelcontextprotocol/sdk/server/
// index.js) as well as McpServer; our createServer() returns the
// low-level Server, so registerTools() (which calls setRequestHandler
// directly) transfers verbatim from the stdio path. Tool definitions,
// zod schemas, and the toMcpInputSchema conversion all stay unchanged.
//
// Lifecycle: init() runs once when the MCP session establishes against
// this DO instance. Tool registration happens there; the same Server
// instance handles every subsequent request in the session, with
// transport state preserved on the long-lived DO.
//
// State + Props ship empty in 6c. Real user identity propagation lands
// when external human consumers come online (D-RA-12). At that point,
// LimnerProps grows a userId + scope; defaultHandler's
// completeAuthorization call grows a non-empty props payload.
type LimnerState = Record<string, never>;
type LimnerProps = Record<string, never>;

export class LimnerMCP extends McpAgent<Env, LimnerState, LimnerProps> {
  server = createServer('limner-mcp', VERSION);

  async init(): Promise<void> {
    // compose's jsquash/resvg ops need their WASM initialized before the
    // first tools/call; the modules ship as CompiledWasm bundle imports
    // (see wasm-init.ts) and the latch makes repeat sessions a no-op.
    await initComposeWasmWorkers();
    registerTools(
      this.server,
      [...pipelineTools, composeTool, ...memoryTools, ...projectTools, ...metaTools],
      (): ToolContext => ({
        bindings: buildWorkersBindings(this.env),
        images: this.env.IMAGES as unknown as CFImagesBinding | undefined,
        secrets: buildSecrets(this.env),
      }),
    );
    // Guidance-derived surfaces (D-RA-24). Pure data — no ToolContext needed.
    registerResources(this.server, resources);
    registerPrompts(this.server, prompts);
  }
}

// The OAuthProvider wraps everything. apiHandler is invoked only for
// requests that pass the token check; defaultHandler sees everything
// else (including the /authorize flow).
//
// McpAgent.serve() returns a `{ fetch }`-shaped object — compatible
// with OAuthProvider's apiHandler field at runtime. The cast is a
// structural-only nudge: serve()'s fetch signature is generic over
// Env, while OAuthProvider's apiHandler wants ExportedHandlerWithFetch<Env>
// for a specific Env. Cast through `unknown` to a non-optional-fetch
// shape so TS accepts the assignment without losing runtime correctness.
type ApiHandlerShape = {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
};

// LimnerMCP.serve(...) yields the DO-backed /mcp fetch handler. RT-1 wraps
// it with the per-caller rate limit so abuse is throttled before it reaches
// the Durable Object / D1 / pipeline layer. OAuth validates the token first,
// so the wrapper sees the bearer token it keys on.
const mcpApiHandler = LimnerMCP.serve('/mcp', { binding: 'LIMNER_MCP' }) as unknown as ApiHandlerShape;

const oauthProvider = new OAuthProvider<Env>({
  apiRoute: '/mcp',
  apiHandler: withRateLimit(mcpApiHandler) as unknown as ApiHandlerShape,
  // The defaultHandler serves the unauthenticated /authorize flow
  // (auto-approve + ['mcp'] scope pin) and the root page. RT-1 + A1: wrap it
  // with the same per-caller rate limit as /mcp so /authorize can't be
  // hammered to mint tokens. These requests carry no bearer token, so
  // deriveRateLimitKey falls back to the client IP. It's typed against
  // OAuthEnv (a structural subset of Env); cast for nominal type identity.
  defaultHandler: withRateLimit(
    defaultHandler as unknown as FetchHandler<Env>,
  ) as unknown as ExportedHandler<Env>,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  clientRegistrationEndpoint: '/oauth/register',
  scopesSupported: ['mcp'],
});

// The default export combines the OAuthProvider's fetch handler (HTTP) with a
// scheduled() cron handler (RT-2 / D-RA-20). The cron — `[triggers] crons` in
// wrangler.toml — fires the 30-day R2 retention sweep. Both share Env; the
// sweep no-ops when the BUCKET binding is absent, and runs via waitUntil so a
// slow sweep never blocks the scheduled invocation from returning.
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return oauthProvider.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.BUCKET) return;
    ctx.waitUntil(
      sweepExpiredArtifacts(env.BUCKET, Date.now())
        .then((result) => console.log(`r2 retention sweep: ${JSON.stringify(result)}`))
        .catch((err) => console.error('r2 retention sweep failed', err)),
    );
  },
} satisfies ExportedHandler<Env>;

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
import type { Bindings, CFImagesBinding, ArtifactDelivery } from '@limner/core';

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
import { isArtifactPath, serveArtifact } from './artifact.js';
import { serveFavicon } from './favicon.js';

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
  // PR D — R2 bucket for generated assets returned as URLs (separate from the
  // compose-artifacts BUCKET). Optional so stdio/local/tests boot without it;
  // when absent, image tools fall back to inline base64. The /artifact proxy
  // and the retention sweep no-op without it.
  GENERATED_BUCKET?: R2Bucket;
  // PR D — absolute base for artifact URLs (e.g. https://mcp.limner.us). Plain
  // var (not a secret); the product domain, A4-safe to commit. Delivery is
  // active only when both GENERATED_BUCKET and this are present.
  ARTIFACT_BASE_URL?: string;
  // PR D — optional HMAC-SHA256 secret. When set, artifact URLs are signed +
  // time-limited; when absent, the unguessable UUID key is the capability.
  ARTIFACT_SIGNING_KEY?: string;
  // D-RA-22 — comma-separated allowlist of first-party OAuth client_ids that
  // bypass the consent screen and auto-approve. Plain var (a client_id is
  // public, A4-safe); absent/empty trusts no client. The live agent's client_id
  // ROTATES, so OAUTH_TRUSTED_REDIRECT_URIS is the durable signal for it; this
  // stays for pinning fixed ids. Consumed by isTrustedClient (auth/consent.ts).
  OAUTH_TRUSTED_CLIENT_IDS?: string;
  // D-RA-22 — comma-separated allowlist of first-party redirect_uris that bypass
  // the consent screen and auto-approve. The durable agent-compat signal: the
  // live agent's first-party client keeps a stable redirect_uri
  // (https://claude.ai/api/mcp/auth_callback) while its client_id rotates.
  // Plain var (a redirect_uri is public, A4-safe). Consumed by
  // isTrustedRedirectUri (auth/consent.ts).
  OAUTH_TRUSTED_REDIRECT_URIS?: string;
  // D-RA-22 — HMAC-SHA256 secret for the consent CSRF token. A Cloudflare
  // Secret (`wrangler secret put`), never committed. Absent → the consent flow
  // fails closed for non-trusted clients (trusted clients still auto-approve).
  OAUTH_CONSENT_SIGNING_KEY?: string;
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

// PR D: assemble the artifact-delivery config when both the bucket and base URL
// are configured. Absent -> image tools keep returning inline base64.
function buildDelivery(env: Env): ArtifactDelivery | undefined {
  if (!env.GENERATED_BUCKET || !env.ARTIFACT_BASE_URL) return undefined;
  return {
    bucket: env.GENERATED_BUCKET,
    baseUrl: env.ARTIFACT_BASE_URL,
    ...(env.ARTIFACT_SIGNING_KEY ? { signingKey: env.ARTIFACT_SIGNING_KEY } : {}),
  };
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
        delivery: buildDelivery(this.env),
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
    const pathname = new URL(request.url).pathname;
    // Public brand favicon — served before OAuth so the auth/consent pages get a
    // real icon instead of a 404. No auth, no state, just the embedded mark.
    if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
      return Promise.resolve(serveFavicon());
    }
    // PR D: the public /artifact/<key> proxy is served before OAuth — the
    // unguessable capability URL (optionally HMAC-signed) is the access grant,
    // so MCP clients / the CMA agent fetch generated assets without a token.
    if (isArtifactPath(pathname)) {
      return serveArtifact(request, env);
    }
    return oauthProvider.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // Sweep both retention buckets (compose artifacts + generated assets).
    const buckets = [env.BUCKET, env.GENERATED_BUCKET].filter(
      (b): b is R2Bucket => Boolean(b),
    );
    for (const bucket of buckets) {
      ctx.waitUntil(
        sweepExpiredArtifacts(bucket, Date.now())
          .then((result) => console.log(`r2 retention sweep: ${JSON.stringify(result)}`))
          .catch((err) => console.error('r2 retention sweep failed', err)),
      );
    }
  },
} satisfies ExportedHandler<Env>;

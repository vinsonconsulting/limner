# @limner/mcp

Limner's MCP server. One TypeScript surface, three transports (Workers Streamable HTTP + stdio + `.mcpb` bundle), 15 tools wrapping `@limner/core`.

Built on the brain/hands split from D-RA-01: this is the *durable product surface* (the brain's hands for any MCP client, including Claude Desktop, LobeHub, the CMA agent itself per D-RA-12). Pipeline credentials live in Cloudflare Secrets; never travel to the client.

## Status

Phase 4 of the rebuild. Code lands by phase per [`docs/Limner_Cloudflare_CMA_Architecture.md`](../../docs/Limner_Cloudflare_CMA_Architecture.md); Phase 4 ships the server + OAuth + MCPB packaging. Phase 5 (`limner-cma-tools`) and Phase 7 (deploy) follow.

## Tool surface (15)

| Tool | Description | Output |
|---|---|---|
| `limner_generate_dalle` | OpenAI Images (gpt-image-1 default; dall-e-3 / dall-e-2 also supported) | image |
| `limner_generate_midjourney` | Compose a Midjourney prompt string (HITL; no API call) | text |
| `limner_generate_recraft` | Recraft composed-MCP adapter per D-RA-14 (`mcp.recraft.ai` remote or local stdio) | image |
| `limner_compose` | Hybrid V8 stack (D-RA-16) — single tool, discriminated-union op over 16 primitives | image / text |
| `limner_recall` | Memory query by q / category / since / until / limit | structured |
| `limner_record` | Persist a new memory entry (idempotent via `sourceId`) | structured |
| `limner_forget` | Delete a memory entry by id | structured |
| `limner_list_categories` | Memory categories with counts | structured |
| `limner_list_projects` | Project list by q / limit / offset | structured |
| `limner_get_project_context` | Project + recent notes (identify by id or name) | structured |
| `limner_record_project_note` | Append a note to a project | structured |
| `limner_health` | bindings flavor + version + timestamp | structured |
| `limner_version` | server version | structured |
| `limner_list_pipelines` | id/displayName/kind/requiredSecrets per pipeline | structured |
| `limner_pipeline_capabilities` | per-pipeline detail | structured |

The `limner_compose` tool's op surface covers `resize`, `crop`, `brightness`, `contrast`, `blur`, `sharpen`, `watermark`, `encode`, `decode`, `convert`, `renderText`, `cfTransform`, `cfOverlay`, `cfBlur`, `cfSmartCrop`, `cfBackgroundFill`. The `cf*` ops require the Workers transport (Cloudflare Images binding); the stdio transport returns an `unsupported_in_stdio` error for those.

## Transports

### 1. Stdio (preview at v1 per D-RA-05 amendment)

For Claude Desktop, local dev, the `.mcpb` bundle, anywhere stdin/stdout JSON-RPC works.

```bash
# Build the package.
pnpm install --frozen-lockfile
pnpm -r build

# Run directly (the binary is wired via package.json#bin).
node packages/limner-mcp/dist/stdio.js

# Or via npx after a `pnpm publish` (Phase 6+).
npx -y limner-mcp
```

Env vars consumed at startup:

- `OPENAI_API_KEY` — for `limner_generate_dalle`
- `RECRAFT_API_KEY` — for `limner_generate_recraft` (remote mode)
- `LIMNER_DB_PATH` — local SQLite path (default `~/.limner/limner.db`)
- `LIMNER_SCHEMA_PATH` — schema source (default resolved relative to dist)

### Claude Desktop snippet

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
{
  "mcpServers": {
    "limner": {
      "command": "node",
      "args": ["/absolute/path/to/limner/packages/limner-mcp/dist/stdio.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "RECRAFT_API_KEY": "...",
        "LIMNER_DB_PATH": "/Users/you/.limner/limner.db"
      }
    }
  }
}
```

Post-MCPB-pack (workflow `build-mcpb.yml` triggered on `mcpb-v*` tags), end users install via a single click: open the released `.mcpb` file with Claude Desktop.

### 2. Workers Streamable HTTP (production, OAuth-protected)

Deployed via `wrangler deploy` (Phase 7). The server is wrapped by `OAuthProvider` so all `/mcp` requests require a valid OAuth 2.1 Bearer token.

```bash
# Local dev (binds D1 + KV; IMAGES needs the account to have it enabled).
cd packages/limner-mcp
wrangler dev --local

# MCP Inspector smoke (in another shell):
npx @modelcontextprotocol/inspector http://localhost:8787/mcp
```

OAuth endpoints exposed by the provider:

- `/.well-known/oauth-authorization-server` — RFC 8414 metadata
- `/oauth/token` — token issuance + refresh
- `/oauth/register` — RFC 7591 dynamic client registration
- `/authorize` — auto-approve in v1 dogfood (D-RA-12); explicit consent UI lands later

Bindings in `wrangler.toml`:

| Binding | Resource | Required |
|---|---|---|
| `DB` | D1 `limner-rasa-dev` | yes — memory + projects + sessions |
| `OAUTH_KV` | KV namespace | yes — workers-oauth-provider mandates this name |
| `IMAGES` | Cloudflare Images Transformations | optional — `cf*` compose ops require it |

Secrets (`wrangler secret put ...`):

- `OPENAI_API_KEY` — for `limner_generate_dalle`
- `RECRAFT_API_KEY` — for `limner_generate_recraft` (remote mode)

### 3. `.mcpb` bundle

Packed by `.github/workflows/build-mcpb.yml` on `mcpb-v*` tags. Includes the entire `dist/` tree + `node_modules/` + the `manifest.json` describing tools and env vars. Bundle size: ~27 MB compressed (WASM modules + better-sqlite3 native bindings drive the bulk).

```bash
# Manual pack (matches the CI workflow):
cd packages/limner-mcp
./node_modules/.bin/mcpb pack . ../../limner-mcp.mcpb

# Validate the manifest before packing:
./node_modules/.bin/mcpb validate manifest.json
```

## Architecture

```
                 Anthropic CMA (brain)
                          │
                          │ Path B (per D-RA-12)
                          ▼
       ┌──────────────────────────────────┐
       │  @limner/mcp     (this package)  │
       │                                  │
       │  ┌──────────────────────────┐    │
       │  │ OAuthProvider (D-RA-06)  │    │
       │  │  /.well-known/...        │    │
       │  │  /oauth/{token,register} │    │
       │  │  /authorize (auto-      │    │
       │  │   approve dogfood)      │    │
       │  └────────────┬─────────────┘    │
       │               │ Bearer-valid     │
       │               ▼                  │
       │  ┌──────────────────────────┐    │
       │  │ MCP server.ts            │    │
       │  │  - tool registry         │    │
       │  │  - tools/list + call     │    │
       │  └────────────┬─────────────┘    │
       │               │                  │
       │  ┌────────────▼─────────────┐    │
       │  │ 15 tools (this README ↑) │    │
       │  └────────────┬─────────────┘    │
       └───────────────┼──────────────────┘
                       │
                       ▼
                @limner/core
   (pipelines, compose facade, D1/local stores)
```

## Tests

```bash
pnpm --filter @limner/mcp test
```

The unit suite (run the command above for the live count) covers server dispatch, every tool's input schema + annotations + happy path, the stdio smoke (subprocess + tools/list + health round-trip), the compose tool's cf-images Workers / stdio split, OAuth `/authorize` scope-pinning, per-caller rate limiting, R2 retention sweeps, and the DO-backed worker handshake.

## License

Apache 2.0. See [LICENSE](../../LICENSE).

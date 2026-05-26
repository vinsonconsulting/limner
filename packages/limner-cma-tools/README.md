# @limner/cma-tools

Limner's **Path A** surface (D-RA-12) — CMA sandbox custom tools deployed alongside the Anthropic CMA agent definition. Ships as a library exporting `LIMNER_TOOLS`, a 15-tool array compatible with the [cloudflare/claude-managed-agents](https://github.com/cloudflare/claude-managed-agents) template's `defineTool` shape.

**v1 ships the library; the CMA agent dogfoods Path B (`@limner/mcp`)** per D-RA-12. Once dogfood criteria are met, the agent migrates to Path A to reclaim OAuth-handshake latency. Path B stays the durable contract for all non-CMA consumers.

## Quickstart — consuming from the CMA template

1. Clone the Cloudflare CMA template:

```bash
git clone https://github.com/cloudflare/claude-managed-agents.git my-cma-agent
cd my-cma-agent
```

2. Install `@limner/cma-tools` (workspace install or published; once published, `npm install @limner/cma-tools`):

```bash
# Workspace install from a local Limner clone:
npm install /absolute/path/to/limner/packages/limner-cma-tools
```

3. Edit `src/tools/custom-tools.ts`:

```ts
import { LIMNER_TOOLS } from '@limner/cma-tools';

export const CUSTOM_TOOLS = [
  ...LIMNER_TOOLS,
  // ...your other tools
];
```

4. Wire the bindings in `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    { "binding": "DB", "database_name": "...", "database_id": "..." }
  ],
  "r2_buckets": [
    { "binding": "BUCKET", "bucket_name": "limner-artifacts" }
  ],
  "images": { "binding": "IMAGES" }   // optional, for compose.cf* ops
}
```

5. Set secrets (`wrangler secret put`):

- `OPENAI_API_KEY` — required by `generate_dalle`
- `RECRAFT_API_KEY` — required by `generate_recraft` (remote mode)
- `LIMNER_BUCKET_PUBLIC_URL` (optional) — if your R2 bucket has a public hostname, set this so image tools return absolute URLs instead of `r2://` handles

6. `npm run deploy`. The 15 Limner tools appear in the agent form's toggle list automatically.

## Tool surface

15 tools, mirroring `@limner/mcp` exactly (D-RA-12 lockstep):

| Tool | Description | Required bindings | Returns |
|---|---|---|---|
| `generate_dalle` | OpenAI Images API | BUCKET, OPENAI_API_KEY | image envelope |
| `generate_midjourney` | Midjourney prompt composition (HITL) | (none) | text envelope |
| `generate_recraft` | Recraft composed-MCP adapter (D-RA-14) | BUCKET, RECRAFT_API_KEY | image envelope |
| `compose` | Hybrid V8 stack — 17 ops behind discriminated-union | BUCKET (+ IMAGES for cf-*) | image envelope or JSON |
| `recall` / `record` / `forget` / `list_categories` | Memory ops | DB | structured JSON |
| `list_projects` / `get_project_context` / `record_project_note` | Project ops | DB | structured JSON |
| `health` / `version` / `list_pipelines` / `pipeline_capabilities` | Meta / discovery | (none) | structured JSON |

Image envelope shape:

```json
{ "url": "r2://limner/dalle/<uuid>.png", "mimeType": "image/png", "width": 1024, "height": 1024, "pipeline": "dalle" }
```

The agent fetches `url` via web_fetch / sandbox file APIs. If `LIMNER_BUCKET_PUBLIC_URL` is set, the URL is absolute; otherwise it's an opaque `r2://` handle the consuming Worker resolves to a signed URL.

## Architecture

```
   ┌──────────────────────────────────────────────┐
   │  Anthropic CMA brain                         │
   │   - tool-use planning                        │
   └────────────────────┬─────────────────────────┘
                        │ tool call
                        ▼
   ┌──────────────────────────────────────────────┐
   │  Cloudflare CMA template (Worker)            │
   │  - cloudflare/claude-managed-agents fork     │
   │  - src/tools/custom-tools.ts:                │
   │       CUSTOM_TOOLS = [...LIMNER_TOOLS, ...]  │
   │  - bindings: DB, BUCKET, IMAGES (+ secrets)  │
   └────────────────────┬─────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────┐
   │  @limner/cma-tools (this package)            │
   │  - LIMNER_TOOLS (15 tools)                   │
   │  - inputSchema re-exported from @limner/mcp  │
   │  - run handlers convert to CMA's `string`    │
   │    return: image -> upload R2 + envelope     │
   └────────────────────┬─────────────────────────┘
                        │
                        ▼
                 @limner/core
   (pipelines, compose facade, D1/local stores)
```

## Why is `@limner/mcp` a runtime dep?

`@limner/cma-tools` re-imports each tool's zod `inputSchema` from `@limner/mcp/tools/*`. This keeps Path A and Path B schemas single-source — fixing one place fixes both. The CMA template's dispatcher uses only the schemas, not `@limner/mcp`'s server / OAuth / transport code, so the bundle size impact is minimal (tree-shaking eliminates unused exports at deploy time).

## Tests

```bash
pnpm --filter @limner/cma-tools test
```

30 tests:

- `runtime.test.ts` — `defineTool` identity + `requires` predicate
- `r2-upload.test.ts` — R2 key shape, mime-to-extension, envelope JSON
- `index.test.ts` — `LIMNER_TOOLS` surface (15 tools, unique names, gating)
- `tools/state-tools.test.ts` — memory + project + meta ops against miniflare-emulated D1

Image-returning pipeline tools (DALL-E, Recraft) aren't unit-tested end-to-end here because they need fetch + R2 + pipeline mocking together; the per-piece behaviors are covered (the @limner/mcp tests cover the pipeline runners, the r2-upload tests cover the R2 path, the envelope shape is tested). Full E2E lands in Phase 7's deploy smoke.

## License

Apache 2.0. See [LICENSE](../../LICENSE).

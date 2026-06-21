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

- `OPENAI_API_KEY` — required by `limner_generate_dalle`
- `RECRAFT_API_KEY` — required by `limner_generate_recraft` (remote mode)
- `LIMNER_BUCKET_PUBLIC_URL` (optional) — if your R2 bucket has a public hostname, set this so image tools return absolute URLs instead of `r2://` handles

6. Initialize the compose WASM (required — see the next section).

7. `npm run deploy`. The 15 Limner tools appear in the agent form's toggle list automatically.

## Compose WASM (consumer requirement)

`limner_compose`'s jSquash codec ops (`encode`/`decode`/`convert`) and the
satori `renderText` op depend on WASM modules. The photon ops
(resize/crop/brightness/contrast/blur/sharpen/watermark) self-initialize and
need nothing. Because Workers and Node acquire WASM differently — and pulling
`node:fs` into a Workers bundle is fatal — `@limner/core` never loads the
modules itself; the platform supplies them and core inits lazily on first use.

The consuming Worker (the Phase-7 CMA agent) does one thing at startup:

```ts
import { initLimnerComposeWasm } from '@limner/cma-tools/compose-wasm';

// once, before serving — e.g. top of the fetch handler / agent bootstrap
await initLimnerComposeWasm();
```

This registers the static-`.wasm` (CompiledWasm) modules with `@limner/core`
and front-loads the resvg + jSquash instantiation. The compose ops also
self-init on first use, so a missed call is not fatal — but calling it makes
the instantiation cost explicit and avoids a first-op latency spike. No
`declare module '*.wasm'` shim or hand-rolled init is needed; the static
imports live inside `@limner/mcp`'s compiled entry, which this subpath
re-exports.

### wrangler bundling

`initLimnerComposeWasm` pulls in `@limner/mcp`'s static `.wasm` imports, which
wrangler bundles as `CompiledWasm` via its **default `**/*.wasm` rule** — no
config needed. If your `wrangler.toml` / `wrangler.jsonc` defines custom
`[[rules]]` (which replace the defaults), re-add the wasm rule explicitly with
`fallthrough` so the default isn't shadowed:

```toml
[[rules]]
type = "CompiledWasm"
globs = ["**/*.wasm"]
fallthrough = true
```

The wasm adds ~8 MB raw (~3 MB gzipped) to the Worker bundle — within the
paid-plan limit, over the free-tier 3 MB cap.

> Limner is an independent third-party project built on Anthropic's CMA
> platform; it is not an Anthropic or Claude product. Bindings
> (`BUCKET` / `DB` / `IMAGES`) and secrets
> (`OPENAI_API_KEY` / `RECRAFT_API_KEY`) are configured on the consuming
> Worker; **secrets live in Cloudflare Secrets — never in source.**

## Tool surface

17 tools, mirroring `@limner/mcp` exactly (D-RA-12 lockstep). Exposed under their BARE
names (no `limner_` prefix) to the CMA agent; `@limner/mcp` registers the same tools with
the `limner_` prefix:

| Tool | Description | Required bindings | Returns |
|---|---|---|---|
| `limner_generate_dalle` | OpenAI Images API | BUCKET, OPENAI_API_KEY | image envelope |
| `limner_generate_midjourney` | Midjourney prompt composition (HITL) | (none) | text envelope |
| `limner_generate_recraft` | Recraft REST API (D-RA-25) | BUCKET, RECRAFT_API_KEY | image envelope |
| `limner_upscale` | Recraft crisp raster upscale (image input) | BUCKET, RECRAFT_API_KEY | image envelope |
| `limner_vectorize` | Recraft raster→SVG vectorization (image input) | BUCKET, RECRAFT_API_KEY | image envelope |
| `limner_compose` | Hybrid V8 stack — 16 ops behind discriminated-union | BUCKET (+ IMAGES for cf-*) | image envelope or JSON |
| `limner_recall` / `limner_record` / `limner_forget` / `limner_list_categories` | Memory ops | DB | structured JSON |
| `limner_list_projects` / `limner_get_project_context` / `limner_record_project_note` | Project ops | DB | structured JSON |
| `limner_health` / `limner_version` / `limner_list_pipelines` / `limner_pipeline_capabilities` | Meta / discovery | (none) | structured JSON |

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
   │  - LIMNER_TOOLS (17 tools)                   │
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
- `index.test.ts` — `LIMNER_TOOLS` surface (17 tools, unique names, gating)
- `tools/state-tools.test.ts` — memory + project + meta ops against miniflare-emulated D1

Image-returning pipeline tools (DALL-E, Recraft) aren't unit-tested end-to-end here because they need fetch + R2 + pipeline mocking together; the per-piece behaviors are covered (the @limner/mcp tests cover the pipeline runners, the r2-upload tests cover the R2 path, the envelope shape is tested). Full E2E lands in Phase 7's deploy smoke.

## License

Apache 2.0. See [LICENSE](../../LICENSE).

# Limner — Cloudflare CMA Architecture

> **Purpose:** Consolidated architecture and implementation plan for Limner after the May 19 2026 Claude Managed Agents self-hosted sandboxes announcement, the 11 architectural decisions locked on 2026-05-20, D-RA-12 added 2026-05-22, D-RA-13 through D-RA-17 added 2026-05-23 (OSS pivot; Recraft via MCP adapter; D1 canonical hardened; hybrid V8 composition; Pixellab dropped from rasa to limner-pixel), D-RA-18 added 2026-05-25 (RetroDiffusion dropped from rasa to limner-pixel, mirroring D-RA-17), and D-RA-22 added 2026-06-05 (public auth gate: OAuth consent screen landing in v1.0.x, superseding the API-key alternative).
>
> **Audience:** Jim (architect / operator); Cowork / Claude Code instance executing the rebuild; future collaborators.
>
> **Status:** Authoritative. Supersedes `Limner_MCP_Server_DevPlan.md`, `Limner_LobeHub_Runbook.md`, and `Limner_CMA_Onboarding_RunBook.md` (the latter is preserved as historical reference for the pre-rearchitecture state).
>
> **Source ADRs:** [Meta](https://www.notion.so/366e75a69b7e81f08871d02ff112e233) · [D-RA-01](https://www.notion.so/366e75a69b7e8131a667ffdc34a181dc) · [D-RA-02](https://www.notion.so/366e75a69b7e81a997f5ca358667c102) · [D-RA-03](https://www.notion.so/366e75a69b7e81289683d90b4df826e6) · [D-RA-04](https://www.notion.so/366e75a69b7e81178730c341e45efaf8) · [D-RA-05](https://www.notion.so/366e75a69b7e81878980ebcef8af9439) · [D-RA-06](https://www.notion.so/366e75a69b7e816a8ac4c14f7e8e3e74) · [D-RA-07](https://www.notion.so/366e75a69b7e8106b8ddcef9f226b0be) · [D-RA-08](https://www.notion.so/366e75a69b7e81d4b5adc015c401fd35) · [D-RA-09](https://www.notion.so/366e75a69b7e810ebd28cc9bb0176bf4) · [D-RA-10](https://www.notion.so/366e75a69b7e81c4b4adefa16f9d4012) · [D-RA-11](https://www.notion.so/366e75a69b7e8189bd16eb5c2d3226ad) · [D-RA-12](https://www.notion.so/368e75a69b7e8126bb03f4b9597a8f7e) · [D-RA-13](https://www.notion.so/36ae75a69b7e81b0b3c0fe8ed344a171) · [D-RA-14](https://www.notion.so/36ae75a69b7e815a8036fa308e3a4a23) · [D-RA-15](https://www.notion.so/36ae75a69b7e81ff8751febc21654d33) · [D-RA-16](https://www.notion.so/36ae75a69b7e81728a9fccb179236db6) · [D-RA-17](https://www.notion.so/36ae75a69b7e812ba4c6d8d54975012a) · [D-RA-18](https://www.notion.so/36be75a69b7e8111881fd2571cf48a4f) · [D-RA-19](https://www.notion.so/375e75a69b7e81b69541df817bbfbae3) · [D-RA-20](https://www.notion.so/375e75a69b7e81c8b502dac3dba5d99d) · [D-RA-21](https://www.notion.so/375e75a69b7e81b9a82bd4f2454563e1) · [D-RA-22](https://www.notion.so/376e75a69b7e81898017dc1852b9868b)

---

## 1. Executive summary

Limner runs on Cloudflare as a TypeScript codebase, with the agent loop on Anthropic and tool execution on Cloudflare V8 isolates. Durable state lives in D1. The MCP server is the durable product surface, shipped as three artifacts from one codebase: a public Workers HTTP endpoint protected by OAuth, a stdio binary for local development, and a `.mcpb` bundle for Claude Desktop installs. The FastAPI shim is killed. The Mac-local CMA agent stays running as a fallback during the rebuild and is decommissioned at flag-day cutover.

**The stack, in one line:** Cloudflare + V8 isolates + D1 + TypeScript + (Workers HTTP MCP + stdio MCP + .mcpb) + OAuth.

> **D-RA-05 amendment (2026-05-23):** stdio ships at v1 labeled "preview" because the MCP 2026-07-28 RC (dropped 2026-05-21) introduces breaking changes to the stateless core spec, OAuth/OIDC alignment, and tool annotation surface. Workers HTTP and `.mcpb` are not preview-tagged. A planned v1.1 refresh against 2026-07-28 final removes the preview tag. See D-RA-05 ADR for full amendment.

---

## 2. Architectural decisions reference

All 11 decisions resolved on 2026-05-20. D-RA-12 added 2026-05-22. D-RA-13 through D-RA-17 added 2026-05-23 processing the assumption-audit research report findings (OSS pivot; Recraft via MCP adapter; D1 canonical hardened; hybrid V8 composition stack replacing Sharp; Pixellab dropped from rasa to limner-pixel). D-RA-18 added 2026-05-25 surfaced by the first live integration test run (RetroDiffusion dropped from rasa to limner-pixel, mirroring D-RA-17). D-RA-19 through D-RA-21 added 2026-06-03 resolving the RT-2 release-track decision gates (OAuth scope, R2 artifact retention, Workers AI fallback). D-RA-22 added 2026-06-05 resolving the pre-public auth gate (OAuth consent screen, superseding the API-key alternative). Each is its own ADR in Notion. Summary:

| ID | Decision | Resolution |
|---|---|---|
| D-RA-01 | Sandbox provider | Cloudflare |
| D-RA-02 | Execution runtime | V8 isolates (default), Containers reserved but not exercised in rasa v1 (per D-RA-16) |
| D-RA-03 | `limner_core` language | TypeScript |
| D-RA-04 | State layer | D1 canonical (supersedes D-LH-03; hardened by D-RA-15) |
| D-RA-05 | MCP server placement | Workers HTTP + stdio + .mcpb, all from day one; stdio labeled "preview" at v1 per 2026-05-23 amendment; v1.1 refresh against 2026-07-28 spec planned |
| D-RA-06 | MCP↔CMA linkage | Public OAuth on Workers (`workers-oauth-provider`) |
| D-RA-07 | FastAPI shim | Killed (supersedes D-LH-01, D-LH-04) |
| D-RA-08 | Migration path | Greenfield TS rebuild on `rebuild/cloudflare-cma`, flag-day cutover |
| D-RA-09 | Bootstrap branch | Tag as `legacy/python-bootstrap-v0`, delete branch |
| D-RA-10 | Cost model | Order-of-magnitude now, detail during impl, monthly review |
| D-RA-11 | Off-ramp criteria | Five named triggers; quantitative thresholds deferred |
| D-RA-12 | CMA agent consumption path | Path B (MCP via OAuth) from v1; migrate to Path A after dogfooding window |
| D-RA-13 | OSS pivot with variant family | Apache 2.0 + CLA; rasa / pixel / ascii multi-repo; git fork; `us.limner/*` namespace via `limner.us` |
| D-RA-14 | Recraft pipeline integration | Compose first-party Recraft MCP (`mcp.recraft.ai` remote + local stdio); adapter pattern; sets precedent for any future composed external MCP |
| D-RA-15 | D1 canonical state hardening | D1 is mandatory not preferred under self-hosted CMA; CMA managed memory and self-hosted sandboxes mutually exclusive; Phase 6 migration is one-way |
| D-RA-16 | rasa v1 composition strategy | Hybrid V8 stack: Photon + jSquash + Satori/resvg + Cloudflare Images Transformations. No Containers in rasa v1; Sharp/libvips path abandoned |
| D-RA-17 | Pixellab dropped from rasa | Specialty tools live in variants, not rasa foundation. Pixellab moves to limner-pixel (Phase C of D-RA-13 build sequencing); rasa pipeline registry shrinks to 4 |
| D-RA-18 | RetroDiffusion dropped from rasa | Consistent application of the D-RA-17 specialty-tool placement principle. RetroDiffusion's model line (`rd_fast` / `rd_pro` / `rd_plus`) is explicitly pixel-art-focused — same category D-RA-17 used to move Pixellab out. Rasa v1 pipeline registry shrinks to 3 (Midjourney, DALL-E, Recraft); RetroDiff moves to limner-pixel where it sits alongside Pixellab and any future pixel-art tooling. The drop was surfaced by integration testing (sync inference timed out locally at 30s; initially misread as an upstream issue), but reading the actual API docs at github.com/Retro-Diffusion/api-examples showed the API is healthy and supports `async_process: true` for long-running jobs — the friction was a sync-timeout misdiagnosis, not an upstream defect. The architectural conclusion stands on the D-RA-17 principle, not on API quality |
| D-RA-19 | rasa v1 OAuth scope | Flat single `mcp` scope (no per-tool/pipeline granularity); dogfood auto-approve. Per-resource scopes + consent screen deferred post-dogfood. Ratifies the implemented posture |
| D-RA-20 | rasa v1 R2 artifact retention | 30-day hard-delete, enforced by an in-worker `scheduled()` cron sweep (not a native lifecycle rule — the deploy token lacks the r2 management scope). Per-user override deferred; buckets created by the operator at deploy |
| D-RA-21 | Workers AI in rasa v1 | Deferred. `image_generate` (Workers AI) is not exposed as a pipeline and there is no Workers-AI fallback; external-pipeline failures surface as errors. Revisit in a future refresh or variant |
| D-RA-22 | Public auth gate | OAuth consent screen, landing in v1.0.x — the gate before external human consumers come online. Supersedes the API-key alternative; extends D-RA-19's dogfood auto-approve posture with a real consent step (and per-client scope policy) |

---

## 3. System architecture

### 3.1 The brain/hands split, applied

Anthropic's framing of self-hosted sandboxes is "decoupling the brain from the hands." For Limner this maps to:

```
┌─────────────────────────────────────────────────────────────────┐
│                          ANTHROPIC                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   CMA agent loop (brain)                                 │   │
│  │   - System prompt, persona, conversation context         │   │
│  │   - Tool-use planning                                    │   │
│  │   - Prompt caching, compaction                           │   │
│  └────┬─────────────────────────────────────────────────────┘   │
└───────┼─────────────────────────────────────────────────────────┘
        │
        │ session events (sandbox)         OAuth HTTPS (MCP)
        │ outbound proxy + secret inject   workers-oauth-provider
        ▼                                  ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  CLOUDFLARE — sandbox        │   │  CLOUDFLARE — MCP server     │
│  (hands)                     │   │  (durable product surface)   │
│                              │   │                              │
│  ┌────────────────────────┐  │   │  ┌────────────────────────┐  │
│  │  V8 isolate            │  │   │  │  Workers Streamable    │  │
│  │  per-session, ms boot  │  │   │  │  HTTP (TS MCP SDK)     │  │
│  └────────┬───────────────┘  │   │  └────────┬───────────────┘  │
│           │                  │   │           │                  │
│  ┌────────▼───────────────┐  │   │  ┌────────▼───────────────┐  │
│  │  Limner custom tools   │  │   │  │  Tool registry         │  │
│  │  (per CMA template)    │  │   │  │  pipelines/memory/ctx  │  │
│  └────────┬───────────────┘  │   │  └────────┬───────────────┘  │
│           │                  │   │           │                  │
│  ┌────────▼───────────────┐  │   │  ┌────────▼───────────────┐  │
│  │  Outbound proxy        │  │   │  │  @limner/core (shared) │  │
│  │  - cred injection      │◀─┴───┴──┤  - pipeline clients    │  │
│  │  - egress policy       │  │   │  │  - memory adapter      │  │
│  └────────┬───────────────┘  │   │  │  - context engine      │  │
│           │                  │   │  └────────┬───────────────┘  │
└───────────┼──────────────────┘   └───────────┼──────────────────┘
            │                                  │
            ▼                                  ▼
   ┌──────────────────┐              ┌──────────────────┐
   │  Pipeline APIs   │              │  D1   │   R2     │
   │  MJ, DALL-E,     │              │  state │ artifacts│
   │  Recraft         │              └──────────────────┘
   └──────────────────┘
```

### 3.2 Two consumption paths

The same `@limner/core` library backs two distinct surfaces:

**Path A — CMA agent path (Anthropic's brain calls hands on Cloudflare):**
- Anthropic-hosted agent loop drives tool calls
- Sandbox (V8 isolate, Cloudflare) executes Limner's custom tools (TS + zod) defined per the CMA template pattern
- Custom tools call into `@limner/core` for pipeline logic
- Outbound proxy injects credentials before pipeline API requests leave Cloudflare's network

**Path B — Direct MCP path (any MCP client calls the public server):**
- LobeHub, Vercel demo, Claude Desktop (via `.mcpb` stdio), CMA agent itself, future marketplace consumers
- All reach the same Workers MCP server via Streamable HTTP + OAuth
- Server's tool handlers call into `@limner/core` — same code as the CMA custom tools
- Pipeline credentials live in Cloudflare Secrets; never travel to the client

Both paths converge on `@limner/core`. One pipeline-calling implementation, two surfaces.

**Which path the CMA agent uses:** Path B from v1 (see D-RA-12). The agent dogfoods the same OAuth-protected MCP surface external consumers hit, which catches any drift between `limner-cma-tools` and `limner-mcp` tool definitions at the earliest point. Once the dogfooding window closes (criteria in D-RA-12), the agent migrates to Path A to reclaim OAuth latency. Path B remains the durable contract for all non-CMA consumers regardless.

### 3.3 What lives where

| Concern | Location | Notes |
|---|---|---|
| Agent reasoning / system prompt | Anthropic CMA | Configured via agent definition |
| Sandbox execution | Cloudflare V8 isolates | Per-session, ms boot |
| Custom tool code (CMA path) | `packages/limner-cma-tools` | TS + zod, deployed via wrangler |
| MCP tool code (direct path) | `packages/limner-mcp` | TS MCP SDK, deployed via wrangler |
| Shared pipeline logic | `packages/limner-core` | TS, consumed by both |
| Pipeline API credentials | Cloudflare Secrets | Injected at outbound proxy |
| Durable state (memory, projects, sessions) | D1 | SQLite-compatible |
| Image artifacts | R2 | Per-session bucket structure |
| OAuth tokens (MCP path) | Cloudflare KV (encrypted) | Per `workers-oauth-provider` |
| Observability | Workers analytics + log shipping | Datadog/Splunk supported |

> **D-RA-15 note (state layer hardening, 2026-05-23):** D1 as canonical state is **mandatory** under self-hosted CMA, not merely preferred. Anthropic's managed Memory Stores API is scoped to Anthropic-hosted CMA agents; self-hosted sandboxes do not compose with managed memory in the current platform. The Phase 6 migration from CMA managed memory to D1 is one-time and one-way; there is no rollback path. See D-RA-15 ADR for full rationale.

> **D-RA-04 amendment (state layer scale ceiling, 2026-05-23):** D1 has a 10 GB cap per database. rasa v1 ships single-D1; sharding deferred to a forecast-triggered ADR (~5–7 GB threshold). Indie/OSS scale runway is multi-year (10M memory entries at ~1 KB each). Monitoring task in Asana tracks the trigger. OSS self-deployers inherit this ceiling. See D-RA-04 amendment for full rationale.

---

## 4. Repo layout

```
limner/
├── packages/
│   ├── limner-core/                # shared TS library
│   │   ├── src/
│   │   │   ├── pipelines/
│   │   │   │   ├── midjourney.ts   # prompt composition; returns text
│   │   │   │   ├── dalle.ts
│   │   │   │   └── recraft.ts      # adapter over Recraft MCP per D-RA-14
│   │   │   ├── compose/            # D-RA-16 hybrid V8 composition stack
│   │   │   │   ├── photon-ops.ts   # Photon primitives (resize, crop, filters)
│   │   │   │   ├── jsquash-codecs.ts # codec/format conversion
│   │   │   │   ├── satori-text.ts  # typography (JSX → SVG → raster)
│   │   │   │   ├── cf-images-transform.ts # CF Images Transformations client
│   │   │   │   └── index.ts        # unified composition facade
│   │   │   ├── memory/
│   │   │   │   └── d1-store.ts
│   │   │   ├── context/
│   │   │   │   └── projects.ts
│   │   │   ├── bindings/
│   │   │   │   ├── workers.ts      # Cloudflare bindings
│   │   │   │   └── local.ts        # SQLite + filesystem for stdio mode
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── limner-mcp/                 # MCP server (Path B)
│   │   ├── src/
│   │   │   ├── server.ts           # tool registry + handlers
│   │   │   ├── stdio.ts            # stdio entry point
│   │   │   ├── worker.ts           # Workers entry point
│   │   │   ├── auth/
│   │   │   │   └── oauth.ts        # workers-oauth-provider wiring
│   │   │   └── tools/
│   │   │       ├── pipelines.ts    # generate_* tools
│   │   │       ├── memory.ts       # limner_recall/limner_record/limner_forget/limner_list_categories
│   │   │       ├── context.ts      # project tools
│   │   │       └── meta.ts         # limner_health/limner_version/limner_list_pipelines
│   │   ├── manifest.json           # mcpb pack manifest
│   │   ├── wrangler.toml
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── limner-cma-tools/           # CMA sandbox custom tools (Path A)
│       ├── src/
│       │   ├── tools/
│       │   │   ├── generate-midjourney.ts
│       │   │   ├── generate-dalle.ts
│       │   │   ├── generate-recraft.ts
│       │   │   └── compose.ts      # hybrid V8 stack per D-RA-16
│       │   └── index.ts            # exports for CMA template integration
│       ├── wrangler.toml
│       ├── package.json
│       └── tsconfig.json
│
├── migrations/
│   ├── 0001_initial_schema.sql     # D1 schema for memory, projects, sessions
│   └── 0002_seed_from_cma.ts       # one-time port of 9 CMA memory entries
│
├── docs/
│   ├── Limner_Cloudflare_CMA_Architecture.md   # this file
│   └── archive/
│       ├── Limner_MCP_Server_DevPlan.md        # historical
│       ├── Limner_LobeHub_Runbook.md           # historical
│       └── Limner_CMA_Onboarding_RunBook.md    # historical
│
├── .github/
│   └── workflows/
│       ├── deploy-mcp-workers.yml
│       ├── deploy-cma-tools.yml
│       ├── build-mcpb.yml          # mcpb pack on tagged releases
│       └── ci.yml                  # tsc, vitest, MCP Inspector smoke
│
├── package.json                    # workspace root
├── pnpm-workspace.yaml             # or npm workspaces
├── turbo.json                      # optional, if Turborepo used
└── tsconfig.base.json
```

Notes:
- Monorepo via pnpm workspaces (or npm workspaces if pnpm friction emerges).
- `limner-cma-tools` deploys separately from `limner-mcp` because they have different deployment targets (CMA template integration vs standalone Workers).
- `limner-core` is workspace-local; consumers import via `@limner/core`.
- Old Python code is not in the new branch's working tree; the `legacy/python-bootstrap-v0` tag preserves it for reference.

---

## 5. Implementation phases

Sequential. Each phase has a definition of done. Branch: `rebuild/cloudflare-cma`.

### Phase 0 — Workspace setup (~half day)

- Cut `rebuild/cloudflare-cma` from current `main`.
- Initialize pnpm workspace + tsconfig base.
- Stub the three packages with empty `package.json` + `tsconfig.json`.
- Stub wrangler configs for `limner-mcp` and `limner-cma-tools`.
- CI workflow files in place but not yet exercising real builds.
- Tag the old `bootstrap/cma-onboard` branch as `legacy/python-bootstrap-v0` and delete (D-RA-09).

**DoD:** `pnpm install && pnpm -r typecheck` passes against empty packages.

### Phase 1 — `@limner/core` foundation (~1 week)

- Type definitions for pipeline interfaces, memory entities, project context.
- Bindings abstraction (`bindings/workers.ts` for Workers env, `bindings/local.ts` for stdio).
- D1 schema (`migrations/0001_initial_schema.sql`): memory entries, projects, sessions.
- D1 store implementation (`memory/d1-store.ts`) with CRUD + search.
- Local SQLite fallback for stdio mode.
- Unit tests via vitest.

**DoD:** D1 and local SQLite stores pass parity tests for CRUD + search.

### Phase 2 — Pipeline ports (~1 week)

Port the 3 pipelines from Python reference (Pixellab dropped per D-RA-17, RetroDiffusion dropped per D-RA-18; both live in limner-pixel):

- `midjourney.ts` — prompt composition only (no API call); returns formatted prompt
- `dalle.ts` — OpenAI Images API client
- `recraft.ts` — **Adapter wrapping Recraft's first-party MCP server** per D-RA-14, not a direct API client. Two transport modes: remote (`mcp.recraft.ai/mcp` API-key auth) and local (stdio via `github.com/recraft-ai/mcp-recraft-server`). The adapter normalizes Recraft's MCP tools into rasa's pipeline surface for consistent naming, error handling, and telemetry. Sets precedent for any future composed external MCP server.

Each pipeline is a class implementing the rasa pipeline contract. The contract has two interfaces: `ApiBackedPipeline` (direct REST client: dalle) and `ComposedMcpPipeline` (adapter over external MCP: recraft today, others as vendors ship MCPs). API calls and adapter calls both use native `fetch` / MCP SDK. Credential consumption goes through the bindings layer (Cloudflare Secrets in Workers mode; env vars in local mode).

**DoD:** Each pipeline has an integration test that hits the real API or composed MCP with a test key, returns a valid response. Mocked tests run in CI.

### Phase 3 — Pillow/Cairo → hybrid V8 composition stack (~1 week)

Per D-RA-16, rasa v1 composition is delivered by a hybrid stack running entirely in V8 isolates. No Containers. Implementation steps:

- Inventory the Pillow/Cairo operations used in the Python legacy reference.
- Map each operation to the appropriate primitive in the hybrid stack:
  - **`@cf-wasm/photon`** — resize, crop, basic filters (brightness/contrast/blur/sharpen), watermarking via composite. Note: Photon's JPEG output sizes balloon after resize; route JPEG output through jSquash or CF Images final-format step.
  - **`jSquash`** — codec/format conversion (AVIF / JPG / PNG / WebP encode/decode); fixes Photon's JPEG limit.
  - **Satori + `@resvg/resvg-wasm`** — typography rendering (JSX → SVG → raster).
  - **Cloudflare Images Transformations API** — overlay composition, blur, visual effects, background fills, smart cropping. Called from V8 via the Images binding.
- Implement `packages/limner-core/src/compose/` as a directory:
  - `photon-ops.ts` — Photon primitives
  - `jsquash-codecs.ts` — codec wrappers
  - `satori-text.ts` — typography renderer
  - `cf-images-transform.ts` — Cloudflare Images Transformations client
  - `index.ts` — unified composition facade so pipeline code stays primitive-agnostic
- Flag any legacy ops that don't have a clean mapping to the hybrid stack. Two known categories of "no clean mapping":
  - **Animation handling** (GIF / WebP animated / APNG frame manipulation) — out of scope for rasa v1; punt to user's pipeline or limner-pixel.
  - **Operations needing libvips parity** — defer; revisit only if user demand surfaces, at which point the Containers off-ramp (D-RA-02 reserved status) becomes a candidate.

**DoD:** Hybrid V8 stack produces visually equivalent output to the Python implementation for the existing test corpus, except for ops in the two known-skip categories above. Cloudflare Images Transformations binding configured on the rasa zone.

### Phase 4 — `limner-mcp` server (~1 week)

- Tool registry (shared between transports).
- stdio entry point (`stdio.ts`) — for local dev and Claude Desktop.
- Workers entry point (`worker.ts`) — for production.
- OAuth wiring via `workers-oauth-provider`.
- All tools from the original dev plan §4:
  - Pipeline tools: `limner_generate_midjourney`, `limner_generate_dalle`, `limner_generate_recraft`, `limner_compose` (hybrid V8 stack per D-RA-16; backed by Photon + jSquash + Satori/resvg + CF Images Transformations)
  - Memory tools: `limner_recall`, `limner_record`, `limner_forget`, `limner_list_categories`
  - Project tools: `limner_list_projects`, `limner_get_project_context`, `limner_record_project_note`
  - Discovery/health: `limner_list_pipelines`, `limner_pipeline_capabilities`, `limner_health`, `limner_version`
- MCPB manifest + `mcpb pack` CI workflow.

**DoD:** MCP Inspector passes against both stdio and Workers HTTP transports. Auth flow works end-to-end.

### Phase 5 — `limner-cma-tools` (~half week)

- Wrap each pipeline tool as a Cloudflare custom tool (TS + zod schema) per the CMA template pattern.
- Wire outbound proxy with secret injection.
- Deploy to Cloudflare alongside the Anthropic CMA agent definition.

**DoD:** A test CMA agent invocation routes through Cloudflare custom tools, calls `@limner/core`, and returns a valid pipeline result.

### Phase 6 — End-to-end smoke and memory migration (~half week)

- Deploy `limner-mcp` to production Workers + OAuth.
- Register new Anthropic CMA agent pointing at the Cloudflare environment and the public MCP server URL.
- Smoke test all 3 pipelines through the new agent (historical plan said 6; D-RA-17/18 dropped Pixellab + RetroDiffusion, leaving Midjourney, DALL-E, Recraft).
- Run `migrations/0002_seed_from_cma.ts` — exports 9 entries from the current CMA memory store, imports into D1.
- Verify memory recall works against the migrated data.

**DoD:** New CMA agent can generate via every pipeline, recall any of the 9 migrated memories, and record new memories that persist in D1.

### Phase 7 — Flag-day cutover (~1 day)

- Re-route any external integrations (LobeHub config, Vercel demo if started) to the new endpoints.
- Mark the old Mac-local CMA agent as cold backup; stop using it for new work.
- Squash-merge `rebuild/cloudflare-cma` to `main`.
- Update project knowledge with this document as the authoritative reference.
- Decommission the old agent ~30 days post-cutover unless an off-ramp trigger fires.

**DoD:** All Limner work happens via the new architecture. `main` is at the new state.

**Total estimated build time:** ~4–5 weeks at focused effort.

---

## 6. Data migration

The only durable artifact crossing from the old architecture to the new is the 9 seeded memory entries in the current CMA memory store. The migration script (`migrations/0002_seed_from_cma.ts`) does:

1. Authenticate against Anthropic Memory Stores API using the existing `ANTHROPIC_API_KEY`.
2. List all entries in the `/_global/` path.
3. For each entry: parse content + metadata, map to D1 schema, insert.
4. Verify count and content checksums match source.
5. Generate a migration report (entries migrated, any rejected, schema deltas applied).

This runs once at Phase 6. The script is idempotent (uses upserts keyed on source entry ID) so re-running is safe.

---

## 7. Cost model (order of magnitude — full detail in D-RA-10)

| Scenario | Monthly cost |
|---|---|
| Solo Jim, current usage | ~$5–10 |
| 100-user marketplace (moderate usage, BYO keys) | ~$25–50 |
| 1000-user marketplace (heavy R2 retention) | $100s, dominated by R2 |

**Amendment 2026-05-23 (D-RA-10 light-touch batch, from research report findings):**

- **Containers active-CPU billing** — Cloudflare Containers + Sandbox SDK GA April 13 2026; billed per 10 ms active runtime, with included monthly usage on $5 Workers Paid plan. **Not exercised in rasa v1 per D-RA-16** (composition uses hybrid V8 stack instead). May be relevant for limner-pixel sprite-sheet work post-fork.
- **AI Gateway log overage** — Workers Paid includes 1 M logs/month; overage is not pay-as-you-go (must delete logs or upgrade to Enterprise). Mitigation: Logpush to R2 ($0.05/M records) tracked under task [A6].
- **Explicit Claude per-1 M-token cost** — dominates all other line items for interactive use. Anthropic has not published CMA-specific pricing; cost is sandbox + standard Claude API token usage.
- **Cloudflare Images Transformations** (D-RA-16) — 5,000 free unique transformations per month, $0.50 per 1,000 unique after. At indie scale (~500 sessions × 10 composition ops/session = 5,000/mo) the free tier covers usage. 10,000-session-per-month deployment runs ~$22.50/mo on Images transforms.

**Under D-RA-13 (OSS pivot):** self-deploying users carry their own Cloudflare and Anthropic costs; Limner the project does not pay for their usage. Hosted-tier costs apply only if/when an EO3-style enterprise wedge is built.

Refined during implementation with actual telemetry. Monthly review post-launch.

---

## 8. Off-ramp triggers (full detail in D-RA-11)

The architecture is reversible. Five named triggers prompt re-evaluation:

1. Cloudflare CMA platform instability
2. Cost overruns above sustainable thresholds
3. Anthropic deprecates or fundamentally changes self-hosted sandboxes
4. Alternative provider becomes dramatically better for a specific Limner need
5. Specific technical blocker without a Cloudflare-side solution

Response: open a `D-RA-EXIT-XX` ADR documenting the trigger and candidate response. Do not patch around triggers silently.

---

## 9. What this supersedes

- `Limner_MCP_Server_DevPlan.md` — entirely (host-side execution model no longer applies)
- `Limner_LobeHub_Runbook.md` — entirely (FastAPI shim killed per D-RA-07)
- `Limner_CMA_Onboarding_RunBook.md` — entirely (Mac-local onboarding flow replaced by Cloudflare deployment)
- D-LH-01 (Option C hybrid: shim + MCP server in parallel)
- D-LH-03 (CMA memory canonical)
- D-LH-04 (polling not streaming in shim)

Project knowledge files for the superseded docs should be moved to `docs/archive/` and replaced in the chat-project context with this document.

---

## 10. What stays valid

- `UPS_v1_Specification.md` and its locked decisions D-01 through D-15 — historical, but the embedding/retrieval/MCP-tooling patterns there still inform L5 memory work later.
- `Limner_MCP_Server__Mid-2026_Landscape_and_Assumption_Audit.md` — most findings still hold; the A1 KEEP (FastMCP Python) verdict is overridden for Limner specifically by D-RA-03, but the rest of the audit (transport, auth, distribution, monetization) maps directly onto the new architecture.
- D-LH-02 (limner_core shared library) — the *concept* is preserved; language is now TS per D-RA-03.

---

## 11. Side-actions queued

These run in parallel with Phase 0/1 rather than gating any phase:

- **Submit MCP tunnel access request** at https://claude.com/form/claude-managed-agents. Grants optionality on D-RA-06 even though v1 doesn't require it. Cheap to request now; expensive to need later without access.
- **Fork the Cloudflare CMA template repo** (`cloudflare/claude-managed-agents`) to study the custom-tool pattern, outbound proxy wiring, and deployment flow in detail. Informs Phase 5.
- **Read the self-hosted sandboxes docs end-to-end** at https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes. Informs the CMA template integration.
- **Walk the Anthropic cookbook samples** at https://github.com/anthropics/claude-cookbooks/tree/main/managed_agents/self_hosted_sandboxes. Informs Phase 5.

---

## 12. Open questions deferred to implementation

These are not architectural blockers but will need answers during the rebuild:

- _Sharp gaps vs Pillow/Cairo — moot: D-RA-16 abandoned Sharp for the hybrid V8 stack, and Phase 3 shipped against that stack (visual-equivalence tested, SSIM ≥ 0.98)._
- D1 schema for memory: starting minimal (id, content, category, created_at, metadata JSON), evolving as retrieval patterns emerge.
- _OAuth scope, R2 artifact retention, and Workers AI fallback — resolved 2026-06-03 as D-RA-19 / D-RA-20 / D-RA-21 (see §2)._
- Pricing model for marketplace distribution: subscription vs metered, BYO keys vs Limner-supplied. Deferred until functional parity exists.

---

## 13. References

### Asana
- [Rearchitect Limner around CMA self-hosted sandboxes](https://app.asana.com/1/1212919073745452/project/1213651426619052/task/1214964325371784) — the tracking task for this rearchitecture
- [Build Limner MCP server](https://app.asana.com/1/1212919073745452/project/1213651426619052/task/1214542494852479) — still active; scope updates per this document
- [Build Limner public demo](https://app.asana.com/1/1212919073745452/project/1213651426619052/task/1214542732064855) — still active; downstream of MCP server
- Shim tasks 1214587903877682 and 1214588212583266 — closed per D-RA-07

### Notion
- [Meta-ADR](https://www.notion.so/366e75a69b7e81f08871d02ff112e233) and the 11 sub-ADRs (D-RA-01 through D-RA-11, linked in §2)

### Project docs (in `~/GitHub/limner/docs/`)
- This file is the authoritative architecture document.
- Archived: `Limner_MCP_Server_DevPlan.md`, `Limner_LobeHub_Runbook.md`, `Limner_CMA_Onboarding_RunBook.md`
- Still valid: `Limner_MCP_Server__Mid-2026_Landscape_and_Assumption_Audit.md` (with the A1 override noted)

### External
- Cloudflare blog (2026-05-19): https://blog.cloudflare.com/claude-managed-agents/
- Anthropic blog (2026-05-19): https://claude.com/blog/claude-managed-agents-updates
- Anthropic self-hosted sandboxes docs: https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes
- Cloudflare CMA template: https://github.com/cloudflare/claude-managed-agents
- Anthropic cookbook samples: https://github.com/anthropics/claude-cookbooks/tree/main/managed_agents/self_hosted_sandboxes
- TS MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
- workers-oauth-provider: https://github.com/cloudflare/workers-oauth-provider
- Sharp: https://sharp.pixelplumbing.com/
- MCPB packaging: https://github.com/anthropics/mcpb
- MCP Inspector: https://github.com/modelcontextprotocol/inspector

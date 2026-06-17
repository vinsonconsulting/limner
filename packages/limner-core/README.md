# @limner/core

Shared TypeScript foundation for Limner. Provides:

- **Domain types** — pipelines, memory entries, projects, sessions
- **Bindings abstraction** — a discriminated union over Cloudflare Workers
  bindings vs local stdio bindings, so the same store code runs both server-
  side and in the stdio MCP binary
- **Memory store** — `D1MemoryStore` + `LocalMemoryStore` (node:sqlite)
  with parity-tested behavior
- **Project store** — `D1ProjectStore` + `LocalProjectStore` for project
  context and notes

Consumed by `@limner/mcp` (the MCP server) and `@limner/cma-tools` (the CMA
sandbox custom tools). Both packages depend on this one via `workspace:*`.

## Status

Phase 1 of the rebuild — foundation only. Pipelines (Phase 2), composition
(Phase 3), MCP transports (Phase 4), and CMA tool wiring (Phase 5) ship in
later phases and import their pipeline / memory / project surfaces from
here.

See [`docs/Limner_Cloudflare_CMA_Architecture.md`](../../docs/Limner_Cloudflare_CMA_Architecture.md)
for the full architecture; this package implements §3.3 (state layer),
§4 (repo layout), and the Phase 1 DoD from §5.

## Bindings

```ts
import { createLocalBindings, type Bindings } from '@limner/core';

// Workers mode — env populated by the runtime
const workersBindings: Bindings = {
  kind: 'workers',
  DB: env.DB,         // D1Database binding from wrangler.toml
  BUCKET: env.BUCKET, // optional; Phase 2+
  TOKENS: env.TOKENS, // optional; Phase 4+
};

// Local mode — stdio MCP, tests, CLI
const localBindings = createLocalBindings({
  dbPath: '/path/to/limner.db',       // or ':memory:'
  schemaPath: '/path/to/migrations/0001_initial_schema.sql',
  // OR pass schemaSql directly
});
```

`isWorkers(bindings)` / `isLocal(bindings)` narrow the union when you need
backend-specific access.

## Memory

```ts
import { createMemoryStore } from '@limner/core';

const memory = createMemoryStore(bindings);

await memory.record({ content: 'project decision', category: 'adr' });
const recent = await memory.recall({ category: 'adr', limit: 10 });
const cats = await memory.listCategories();
```

`sourceId` (optional) is the idempotency key for the Phase 6 CMA-memory
backfill — re-running `record` with the same `sourceId` upserts.

## Projects

```ts
import { createProjectStore } from '@limner/core';

const projects = createProjectStore(bindings);

const rasa = await projects.create({ name: 'rasa', description: '...' });
await projects.addNote({ projectId: rasa.id, content: 'progress' });
const notes = await projects.listNotes(rasa.id);
```

`delete()` cascades to `project_notes` via the schema's FK constraint.

## Compose

Hybrid V8 composition stack per D-RA-16. Functions, not pipelines — internal stages used by the Phase 4 MCP `compose` tool and the Phase 5 CMA custom tool. Four primitive modules + unified facade:

```ts
import { compose } from '@limner/core';

const resized = compose.resize(inputBytes, 512, 512, 'cover');
const asJpeg  = await compose.convert(resized, 'png', 'jpeg', { quality: 85 });
const labeled = compose.watermark(asJpeg, logoBytes, 16, 16);
```

**The JPEG-output-size quirk** (D-RA-16): Photon balloons JPEG output after `resize` / `crop` / `watermark`. Route JPEG output through `compose.encode('jpeg', ...)` (jSquash) or `compose.cfTransform(..., {}, 'image/jpeg')` (CF Images) for the size fix.

**V8 memory cap**: V8 isolates cap at 128 MB total (V8 runtime + WASM modules + image data). Practical ceiling ~10 megapixels per image. For oversize work, route through `compose.cfTransform()` (network primitive, no in-isolate memory pressure).

### Primitive APIs

| Function | Module | Notes |
|---|---|---|
| `compose.resize` | photon-ops | `fit: 'cover' \| 'contain'`. JPEG output requires re-encode (see quirk). |
| `compose.crop` | photon-ops | Rectangular crop, `(x, y, width, height)` shape. |
| `compose.brightness` / `contrast` / `blur` / `sharpen` | photon-ops | In-isolate filters. |
| `compose.watermark` | photon-ops | Single-layer overlay; multi-layer = chain calls or use `cfOverlay`. |
| `compose.encode` / `decode` / `convert` | jsquash-codecs | JPEG / PNG / WebP / AVIF. |
| `compose.renderText` | satori-text | JSX → SVG → PNG. Default font: IBM Plex Sans (SIL OFL) in `assets/fonts/`. Call `ensureResvgInit` first in Workers; in Node tests use the helper at `test/compose/helpers/satori-init.ts`. |
| `compose.cfTransform` / `cfOverlay` / `cfBlur` / `cfSmartCrop` / `cfBackgroundFill` | cf-images-transform | Requires the Cloudflare Images binding (wires up Phase 4). |

### Known-skip categories (D-RA-16, D-RA-17)

- Animation handling (GIF / WebP-animated / APNG)
- libvips-parity advanced ops (revisit on user demand; D-RA-02 Containers off-ramp candidate)
- Pixel-art-specific composition (NEAREST upscale, palette quantization, chroma key, grayscale tinting) — lives in `limner-pixel` post-D-RA-17 fork

## Schema

Source of truth lives at the repo root: `migrations/0001_initial_schema.sql`.
The same file is consumed by both `wrangler d1 migrations apply` (Workers /
D1 deploys) and `createLocalBindings({ schemaPath })` (stdio / tests).

Phase 6 adds `migrations/0002_seed_from_cma.ts` for the one-time backfill of
existing CMA managed-memory entries.

## Testing

### Unit + parity tests (default, CI-safe)

```bash
pnpm --filter @limner/core test
```

- `test/memory.parity.test.ts` — 12 cases × 2 backends = 24 tests
- `test/context.parity.test.ts` — 8 cases × 2 backends = 16 tests
- `test/pipelines/midjourney.test.ts` — 25 tests (prompt composition)
- `test/pipelines/dalle.test.ts` — 18 tests (mocked fetch)
- `test/pipelines/recraft.test.ts` — 15 tests (mocked transport)
- `test/compose/photon-ops.test.ts` — 12 tests (raster primitives)
- `test/compose/jsquash-codecs.test.ts` — 12 tests (codecs + roundtrip + cross-format)
- `test/compose/satori-text.test.ts` — 2 tests (typography render + SSIM ≥ 0.98 vs reference)
- `test/compose/cf-images-transform.test.ts` — 8 tests (mock binding)
- `test/compose/facade.test.ts` — 20 tests (surface presence + cross-primitive round-trip)
- `test/compose/legacy-equivalence.test.ts` — 3 active + 6 known-skip (SSIM ≥ 0.98 vs Python legacy per D-RA-16)

All mocked. No real HTTP, no API keys required. Runs in ~2 seconds.

(RetroDiffusion moved to `limner-pixel` per D-RA-18.)

If a behavior diverges between D1 and local SQLite backends, the parity
suite catches it before it can ship in `@limner/mcp` or `@limner/cma-tools`.

### Integration tests (opt-in, real upstream calls)

Integration tests live in `test/**/*.integration.test.ts` and are
**excluded from the default `pnpm test` run** via `vitest.config.ts`.

```bash
# Run all integration tests; each describe.skipIf()s itself when its
# env var is absent.
OPENAI_API_KEY=sk-... \
pnpm --filter @limner/core test:integration
```

| Pipeline | Env var | Status |
|---|---|---|
| DALL-E | `OPENAI_API_KEY` | live |
| Recraft | `RECRAFT_API_KEY` | direct REST (`RestRecraftTransport`, D-RA-25 — `external.api.recraft.ai/v1`); integration test is a `describe.todo` stub (avoids a paid call in the default suite) |
| compose (`cf-images-transform`) | `CLOUDFLARE_API_TOKEN` | binding deployed (`[images]` in `@limner/mcp`'s wrangler.toml since Phase 4); integration body gated on `LIMNER_MCP_DEV_URL` + `CLOUDFLARE_API_TOKEN` |

Each live integration test makes one real API call (counts against your
quota). Timeout is 90 seconds per test.

### Running integration tests in CI

Repo-level GitHub Actions workflow: [`.github/workflows/integration.yml`](../../.github/workflows/integration.yml).
Manual trigger only (`workflow_dispatch`) — never on push or PR — so API
credits aren't burned per commit.

**One-time maintainer setup** (run once per repo, requires the `repo`
scope on your GitHub token):

```bash
gh secret set OPENAI_API_KEY --body "sk-..."
# RECRAFT_API_KEY: add when the Recraft integration tests come off
# describe.todo (the transport itself shipped in @limner/mcp, Phase 4).
```

**Triggering a run** from the CLI:

```bash
gh workflow run Integration --ref rebuild/cloudflare-cma
gh run watch  # tail the latest run
```

Or from the Actions tab on GitHub: **Actions → Integration → Run workflow**,
pick the branch, click the green button.

The workflow is safe to run before any secrets are populated — each test
`describe.skipIf()`s its own required env var, and skipped tests count as
a pass. Verifying the workflow itself is healthy is a valid use of an
empty-secrets run.

**OSS note:** GitHub Actions Secrets are not exposed to PRs from forks
(security policy). Community contributor PRs will see the integration
workflow's secrets resolve to empty strings and the tests skip
accordingly. Only maintainer-driven branches get the live keys.

## License

Apache 2.0. See repo-root [LICENSE](../../LICENSE).

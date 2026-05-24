# @limner/core

Shared TypeScript foundation for Limner. Provides:

- **Domain types** — pipelines, memory entries, projects, sessions
- **Bindings abstraction** — a discriminated union over Cloudflare Workers
  bindings vs local stdio bindings, so the same store code runs both server-
  side and in the stdio MCP binary
- **Memory store** — `D1MemoryStore` + `LocalMemoryStore` (better-sqlite3)
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

## Schema

Source of truth lives at the repo root: `migrations/0001_initial_schema.sql`.
The same file is consumed by both `wrangler d1 migrations apply` (Workers /
D1 deploys) and `createLocalBindings({ schemaPath })` (stdio / tests).

Phase 6 adds `migrations/0002_seed_from_cma.ts` for the one-time backfill of
existing CMA managed-memory entries.

## Testing

Parity tests under `test/` run the same suites against both backends:

- `test/helpers/fixtures.ts` — Local fixture uses better-sqlite3
  in-memory; D1 fixture uses miniflare-emulated D1 inside node
- `test/memory.parity.test.ts` — 12 cases × 2 backends = 24 tests
- `test/context.parity.test.ts` — 8 cases × 2 backends = 16 tests

```bash
pnpm --filter @limner/core test
```

If a behavior diverges between backends, the test suite catches it before
it can ship in `@limner/mcp` or `@limner/cma-tools`.

## License

Apache 2.0. See repo-root [LICENSE](../../LICENSE).

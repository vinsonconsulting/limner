# Changelog

All notable changes to Limner (rasa) are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project aims to
adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Pre-Test-1 surface sweep: internal decision references (D-RA-14/16)
  removed from client-rendered tool descriptions and the manifest;
  paid-API cost signaling added to the DALL·E and Recraft generator
  descriptions; `project not found` errors now include the requested
  identifier; manifest and root README state storage per transport (D1
  on Workers, node:sqlite in the stdio/.mcpb build); stale Phase-4/7
  test comments updated. (p2)

### Fixed
- First-run integrity on the default database path: `createLocalBindings`
  now creates the db file's parent directory (`~/.limner/` for the stdio
  default), so a fresh `.mcpb` install no longer dies at boot with
  SQLITE_CANTOPEN; the boot smoke gained a true first-run pass (fresh
  `$HOME`, no `LIMNER_DB_PATH`) that failed red against the pre-fix
  bundle. (p1)

### Changed
- The `.mcpb` production closure is now exactly the stdio runtime graph:
  Workers-only `agents` and `@cloudflare/workers-oauth-provider` moved to
  devDependencies (wrangler bundles them from source; Workers output is
  byte-identical), shrinking the bundle from ~64 MiB to ~10.5 MiB and the
  unpacked closure from 250 to 119 packages; the boot smoke now asserts
  zero native addons and the exact worker-dep absent / stdio-dep present
  sets. (n2)
- Local persistence migrated from `better-sqlite3` to Node's built-in
  `node:sqlite` (D-RA-23): the `.mcpb` bundle no longer ships a
  platform/ABI-specific native addon (boot smoke now asserts better-sqlite3
  stays out of the closure), the Node floor is declared as
  `engines.node >= 22.13` + manifest `compatibility.runtimes.node`, and the
  local test fixtures run on any modern Node without rebuilding a gyp
  binding. (n1)
- Docs: decision D-RA-22 (public auth gate = OAuth consent screen, landing in
  v1.0.x, superseding the API-key alternative) is now linked from the
  architecture decision table, intro enumerations, and `oauth.ts` comments;
  the core README's integration-test matrix reflects the shipped
  `McpRecraftTransport` (local mode stdio-only per r3) and the deployed
  cf-images binding. (r6)
- Hygiene pass: shared chunked base64 codecs in `@limner/core` replace five
  duplicated per-byte loops; the Recraft MCP client handshake reports the real
  `VERSION` instead of a hardcoded literal; `limner_record` corrects
  `idempotentHint` to `false` (plain records append; only `sourceId` upserts);
  the compose cf-op gate distinguishes a Worker missing the IMAGES binding
  (`images_binding_missing`) from the stdio transport
  (`unsupported_in_stdio`); rate-limit keys hash the bearer token (FNV-1a)
  instead of embedding the raw credential. (r5)

### Added
- Compose schema parity is now exact-set: the advertised `op` enum must equal
  the strict 16-op union, advertised property keys must cover every variant
  key, and `toMcpInputSchema`'s union-flattening semantics (first-wins,
  string-enum discriminator, intersection `required`) are pinned by
  characterization tests; `@limner/cma-tools`' compose dispatch gains direct
  coverage (R2 envelope, cf-op gate, strict validation). (r4)

### Fixed
- `limner_generate_recraft`: `mode:"local"` now returns a clear
  `unsupported_in_workers` tool error on the Workers transport instead of
  attempting to spawn a stdio subprocess inside the isolate; the upstream raw
  MCP response is no longer duplicated into `structuredContent` metadata. (r3)
- `.mcpb` boot integrity: the packed bundle now boots standalone — the D1
  schema is embedded at build time (generated `INITIAL_SCHEMA_SQL`;
  `LIMNER_SCHEMA_PATH` still overrides), the bundle packs from a hoisted
  `pnpm deploy --prod` output so the full dependency closure ships, LICENSE
  and NOTICE are included (Apache-2.0 §4), and CI boot-smokes every packed
  bundle. (r2)
- WASM initialization for the jSquash codecs and resvg on both transports —
  compose `encode`/`decode`/`convert`/`renderText` previously failed at runtime
  outside the test suite (Workers: modules now statically imported and attached
  to the bundle; stdio: loaded via `createRequire` at boot). (r1)

## [1.0.0] - 2026-06-04

v1.0.0 is the first public release — the foundation (`rasa`) variant of the
Limner family. The pre-1.0 history (Phases 0–7 of the Cloudflare CMA rebuild)
established the TypeScript monorepo, the three generation pipelines
(DALL·E / Recraft / Midjourney), the hybrid V8 composition stack (D-RA-16), the
MCP server across three transports (Workers HTTP / stdio / `.mcpb`), D1-canonical
state (D-RA-04, D-RA-15), and the CMA→D1 memory migration.

### Added
- Native Cloudflare rate limiting on the `/mcp` surface — per-caller, fails open
  when unbound. (RT-1)
- R2 image-artifact retention: 30-day hard-delete via an in-worker scheduled
  cron sweep. (RT-2, D-RA-20)
- Decision records D-RA-19 (flat OAuth scope), D-RA-20 (R2 retention), and
  D-RA-21 (Workers AI deferred).
- ESLint (typescript-eslint flat config) with a `lint` gate; CI coverage
  reporting; a Workers `deploy --dry-run` gate and `.mcpb` validate/pack on every
  PR. (RT-3)
- Community-health files: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `NOTICE`, and this
  changelog. (RT-4)

### Changed
- Extended the record→recall regression guard: `sourceId` upsert idempotency and
  `recall` filter coverage (`q` / `since` / `until` / `limit` / `offset`). (RT-1)
- Documentation accuracy pass: README status and architecture open questions.
  (RT-4)

[Unreleased]: https://github.com/vinsonconsulting/limner/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/vinsonconsulting/limner/releases/tag/v1.0.0

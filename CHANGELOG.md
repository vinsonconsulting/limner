# Changelog

All notable changes to Limner (rasa) are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project aims to
adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

v1.0.0 will be the first public release — the foundation (`rasa`) variant of the
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

[Unreleased]: https://github.com/vinsonconsulting/limner/commits/main

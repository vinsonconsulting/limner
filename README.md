# limner

> MCP image generation agent. Foundation of the Limner family.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![DCO](https://img.shields.io/badge/DCO-required-orange)](https://developercertificate.org/)
[![Status](https://img.shields.io/badge/status-pre--v1-yellow)]()

**Limner** is a Model Context Protocol (MCP) server and CMA-deployable agent for orchestrating image generation across multiple pipelines. This repository contains **rasa**, the foundation variant of the Limner family.

## What this is

Limner gives you one agent surface, multiple image-generation pipelines, and durable memory for project context. It runs on Cloudflare CMA self-hosted sandboxes, ships as an MCP server (Workers HTTP, stdio, `.mcpb`), and uses D1 for state.

Where most image-generation tools wrap a single model, Limner composes across DALL·E, RetroDiffusion, Recraft, and Midjourney (prompt-only), with a hybrid V8 composition stack for layering and post-processing.

## The Limner family

Limner is a branded variant family. Each variant builds on **rasa** (this repo) and adds opinions for a specific creative niche.

| Repo | Status | Focus |
|---|---|---|
| `vinsonconsulting/limner` (this repo) | rasa, foundation | General-purpose; OSS |
| `vinsonconsulting/limner-pixel` | OSS | Pixel art, sprite work, retro game asset pipelines |
| `vinsonconsulting/limner-ascii` | private | ASCII art workflows |

The legacy proprietary work that preceded the OSS pivot is preserved at `vinsonconsulting/limner-pixel-legacy` for historical reference.

## Stack

- TypeScript monorepo
- Cloudflare CMA self-hosted sandboxes (V8 isolates)
- D1 (durable state: memory, projects, sessions)
- MCP server (Workers Streamable HTTP + stdio + `.mcpb` bundle)
- Composition: Photon, jSquash, Satori + resvg, Cloudflare Images Transformations

See [`docs/Limner_Cloudflare_CMA_Architecture.md`](docs/Limner_Cloudflare_CMA_Architecture.md) for the authoritative architecture reference.

## Status

Pre-v1. The repo is in foundational scaffolding. Code lands in phases per the architecture document:

- Phase 0: Workspace setup
- Phase 1: `@limner/core` foundation
- Phase 2: Pipeline ports
- Phase 3: Hybrid V8 composition stack
- Phase 4: `limner-mcp` server
- Phase 5: `limner-cma-tools`
- Phase 6: End-to-end smoke and memory migration
- Phase 7: Flag-day cutover

## Quickstart

Coming in Phase 4. Until then, see the architecture document for the full design.

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions must include a [Developer Certificate of Origin](https://developercertificate.org/) sign-off via `git commit -s`.

## License

Apache 2.0. See [LICENSE](LICENSE).

## Acknowledgments

Limner is built on [Anthropic's Claude Managed Agents](https://claude.com/blog/claude-managed-agents-updates) platform and [Cloudflare's CMA hosting](https://blog.cloudflare.com/claude-managed-agents/). Limner is an independent project; "built on" does not imply endorsement by Anthropic or Cloudflare.

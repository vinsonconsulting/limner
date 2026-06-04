# limner

> MCP image generation agent. Foundation of the Limner family.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![DCO](https://img.shields.io/badge/DCO-required-orange)](https://developercertificate.org/)
[![Status](https://img.shields.io/badge/status-v1.0.0-blue)]()

**Limner** is a Model Context Protocol (MCP) server and CMA-deployable agent for orchestrating image generation across multiple pipelines. This repository contains **rasa**, the foundation variant of the Limner family.

## What this is

Limner gives you one agent surface, multiple image-generation pipelines, and durable memory for project context. It runs on Cloudflare CMA self-hosted sandboxes, ships as an MCP server (Workers HTTP, stdio, `.mcpb`), and uses D1 for state.

Where most image-generation tools wrap a single model, Limner composes across DALL·E, Recraft, and Midjourney (prompt-only), with a hybrid V8 composition stack for layering and post-processing. Specialty pipelines like pixel-art generation (Pixellab, RetroDiffusion) live in the `limner-pixel` variant per D-RA-17 / D-RA-18.

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

## Pipelines and primitives

### Generation pipelines (`@limner/core` → `packages/limner-core/src/pipelines/`)

- **DALL·E** — OpenAI Images API (gpt-image-1 default; dall-e-3 / dall-e-2 supported)
- **Recraft** — adapter over Recraft's first-party MCP server (remote `mcp.recraft.ai` + local stdio per D-RA-14)
- **Midjourney** — prompt composition only (no API; downstream tool runs the human-in-the-loop step)

RetroDiffusion (D-RA-18) and Pixellab (D-RA-17) live in `limner-pixel`, not rasa.

### Composition stack (D-RA-16, `@limner/core` → `packages/limner-core/src/compose/`)

Hybrid V8 stack running entirely in Cloudflare Workers isolates. No Containers (D-RA-02 reserved). No Sharp / libvips. Four modules + facade:

- **photon-ops** (`@cf-wasm/photon`) — resize, crop, brightness, contrast, blur, sharpen, watermark
- **jsquash-codecs** (`@jsquash/{jpeg,png,webp,avif}`) — encode / decode / convert (fixes Photon's JPEG-output-size quirk)
- **satori-text** (`satori` + `@resvg/resvg-wasm`) — typography (JSX → SVG → PNG). Default font: IBM Plex Sans Regular (SIL OFL 1.1) in `packages/limner-core/assets/fonts/`.
- **cf-images-transform** (Cloudflare Images binding) — overlay, blur, smart-crop, background fill, visual effects (network primitive; binding wires up Phase 4)

Consumed via `import { compose } from '@limner/core'`. Pipeline / MCP tool code never reaches into individual primitive modules. Visual-equivalence tests vs the Python legacy assert SSIM ≥ 0.98.

**Known-skip categories** (per D-RA-16, D-RA-17):

- Animation handling (GIF / WebP-animated / APNG frame manipulation)
- libvips-parity advanced ops (revisit only on user demand; Containers off-ramp candidate per D-RA-02)
- Pixel-art-specific composition (NEAREST upscale, palette quantization, chroma key, grayscale tinting) — lives in `limner-pixel` per D-RA-17

### MCP server (`@limner/mcp` → `packages/limner-mcp/`)

Three transports, one tool surface:

- **Workers Streamable HTTP** — production endpoint at `/mcp`, OAuth-protected via `@cloudflare/workers-oauth-provider` (D-RA-06). Deploy via `wrangler deploy`.
- **stdio** (preview at v1 per D-RA-05 amendment) — for Claude Desktop, local dev, the `.mcpb` bundle.
- **`.mcpb` bundle** — single-click install for Claude Desktop. Packed by `.github/workflows/build-mcpb.yml` on `mcpb-v*` tags.

15 MCP tools wrap the `@limner/core` surface: 3 pipelines (`generate_dalle` / `generate_midjourney` / `generate_recraft`) + 1 composition tool (`compose`, discriminated-union over 17 ops) + 4 memory tools + 3 project tools + 4 meta tools. Full list in [`packages/limner-mcp/README.md`](packages/limner-mcp/README.md).

### CMA custom tools (`@limner/cma-tools` → `packages/limner-cma-tools/`)

The **Path A** surface (D-RA-12) — same 15-tool contract as `@limner/mcp`, packaged for the [cloudflare/claude-managed-agents](https://github.com/cloudflare/claude-managed-agents) template. Ships as a library exporting `LIMNER_TOOLS`; consuming Workers import and spread into their `CUSTOM_TOOLS` array. Per D-RA-12, the CMA agent dogfoods Path B in v1; migration to Path A waits for the dogfood criteria. Full setup in [`packages/limner-cma-tools/README.md`](packages/limner-cma-tools/README.md).

## Status

Hardening toward **v1.0.0**, the first public release. The Cloudflare CMA
rebuild (Phases 0–7) is complete: the TypeScript monorepo, the three generation
pipelines, the hybrid V8 composition stack, the MCP server across all three
transports, D1-canonical state, and the CMA→D1 memory migration are in place and
verified. Current work is production hardening and OSS release readiness — see
[CHANGELOG.md](CHANGELOG.md).

## Quickstart

### Local stdio (Claude Desktop or any stdio MCP client)

```bash
git clone https://github.com/vinsonconsulting/limner.git
cd limner
pnpm install --frozen-lockfile
pnpm -r build

# Run the stdio server directly:
OPENAI_API_KEY=sk-... node packages/limner-mcp/dist/stdio.js
```

For Claude Desktop, add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```jsonc
{
  "mcpServers": {
    "limner": {
      "command": "node",
      "args": ["/absolute/path/to/limner/packages/limner-mcp/dist/stdio.js"],
      "env": { "OPENAI_API_KEY": "sk-...", "RECRAFT_API_KEY": "..." }
    }
  }
}
```

### Local Workers HTTP (smoke-testing the OAuth-protected surface)

```bash
cd packages/limner-mcp
wrangler dev --local

# In another shell:
npx @modelcontextprotocol/inspector http://localhost:8787/mcp
```

### `.mcpb` bundle (Claude Desktop one-click install)

Released via GitHub Actions on `mcpb-v*` tags. Download the `.mcpb` from a release, open with Claude Desktop, fill in the API-key prompts.

### Production deployment

Phase 7 ships the production deploy recipe (`wrangler deploy`, OAuth client registration, DNS / domain). Until then, only local dev + dogfood is in scope.

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions must include a [Developer Certificate of Origin](https://developercertificate.org/) sign-off via `git commit -s`.

## License

Apache 2.0. See [LICENSE](LICENSE).

## Acknowledgments

Limner is built on [Anthropic's Claude Managed Agents](https://claude.com/blog/claude-managed-agents-updates) platform and [Cloudflare's CMA hosting](https://blog.cloudflare.com/claude-managed-agents/). Limner is an independent project; "built on" does not imply endorsement by Anthropic or Cloudflare.

```
    ___       ___       ___       ___       ___       ___
   /\__\     /\  \     /\__\     /\__\     /\  \     /\  \
  /:/  /    _\:\  \   /::L_L_   /::L_L_  /::\  \   /::\  \
 /:/  /    /\/::\__\ /:/L:\__\ /:/L:\__\ /::\:\__\ /\:\:\__\
 \/__/     \::/\/__/ \/_/:/  / \/_/:/  / \:\:\/  / \:\:\/__/
            \:\__\     /:/  /    /:/  /   \:\/  /   \:/__/
             \/__/     \/__/     \/__/     \/__/
```

# Limner

**A framework for portable agent personas, with tools for VGA-era pixel art generation.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Validate](https://github.com/vinsonconsulting/limner/actions/workflows/validate.yml/badge.svg)](https://github.com/vinsonconsulting/limner/actions)
[![Built with Claude Code](https://img.shields.io/badge/Built_with-Claude_Code-blueviolet)](https://claude.ai/code)

*Limner (n.) — A medieval painter of illuminated manuscripts. The craftsperson who renders the visual language.*

---

## What Is This?

Limner is a framework for defining **agent personas** that work across any FM system — Claude Projects, Claude Agent SDK, CrewAI, custom applications, MCP servers, or raw system prompts. It provides the structure, tools, templates, and accumulated learnings that any persona can use.

The framework separates *what an agent knows* from *where it runs*. Swap the runtime, keep the expertise.

The first persona built on this framework is an **Art Director for VGA-era pixel art**, battle-tested through 17+ generation sessions producing 773+ assets for the [Summoning Chamber](https://summoning-chamber.pages.dev) project. Its visual north star is *Darklands* (1992). Its tools are sharp. Its opinions about dithering are strong.

## The Person Schema

A "person" (agent persona) is defined through layered architecture:

| Layer | What It Contains | Example (Limner Art Director) |
|-------|-----------------|------------------------------|
| **Identity** | Name, role, metaphor, voice | "Limner — medieval illuminator. Art Director." |
| **Domain Knowledge** | Reference docs the persona consumes | Style guide, Land palettes, Class environments |
| **Tools** | Scripts/APIs the persona can invoke | VGA validation, palette checking, Retro Diffusion API |
| **Learnings** | Accumulated empirical knowledge | What generation tools actually respond to |
| **Workflows** | End-to-end processes | Generate → Validate → Refine → Catalog |
| **Templates** | Reusable document formats | Session logs, validation reports, handoffs |
| **Project Bindings** | Project-specific context | Summoning Chamber Lands, Classes, assets |

The schema is implicit in the directory structure. A persona is portable: the same knowledge and tools run in Claude Code (via `CLAUDE.md`), the Claude Agent SDK (via `system_prompt` + custom tools), or any other agent framework.

## Quick Start

### As a Claude Code project

```bash
cd limner
claude
```

Then ask Limner to:
- *"Generate a prompt for a Seelie Groves Magister library scene"*
- *"Show me the palette for the Ironroot Holdings"*
- *"Validate this asset against VGA compliance rules"*

The persona activates automatically from `CLAUDE.md`.

### For the Python tools (standalone)

```bash
cd limner
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Validate a pixel art asset against VGA standards
python tools/pixel_art/vga_validate.py path/to/image.png

# Batch validate a directory
python tools/pixel_art/vga_validate.py --batch output/

# Check Retro Diffusion API credits
export RD_API_TOKEN=your_token_here
python tools/api/retro_diffusion.py --credits
```

### As a Claude Agent SDK agent (programmatic)

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Generate a prompt for a Seelie Groves Scryer crystal workshop",
        options=ClaudeAgentOptions(
            system_prompt=open("CLAUDE.md").read(),
            allowed_tools=["Read", "Bash", "Glob", "Grep"],
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

See [`docs/AGENT_SDK_ASSESSMENT.md`](docs/AGENT_SDK_ASSESSMENT.md) for the full architecture plan.

## Repository Structure

```
limner/
├── CLAUDE.md                    # Persona instructions (auto-loaded by Claude Code)
├── reference/                   # Domain knowledge
│   ├── style_guide.md           #   VGA-era visual rules & quality checklist
│   ├── lands.md                 #   10 Lands of Origin with palettes & heraldry
│   ├── classes.md               #   11 Classes with environments & props
│   ├── prompt_templates.md      #   Generation prompt structures (MidJourney)
│   ├── learnings.md             #   Accumulated generation insights
│   └── Summoning_Chamber_*.md   #   Master design docs & codex
├── core/                        # Framework documentation
│   ├── generation/              #   Retro Diffusion API, style presets, letterboxing
│   ├── validation/              #   VGA compliance, palette enforcement, color mode
│   ├── optimization/            #   Indexed color, file size, directory cleanup
│   └── workflows/               #   Post-generation validation, developer handoff
├── tools/                       # Python utilities (standalone scripts)
│   ├── pixel_art/               #   VGA validation, normalization, palette checking
│   ├── api/                     #   Retro Diffusion API client
│   ├── inventory/               #   Asset inventory scanning & verification
│   └── config/                  #   Palette definitions (palettes.json)
├── scripts/                     # Project-level automation
│   ├── generate_scene.py        #   Scene/environment generator
│   └── rd_bootstrap.py          #   Cold-start bootstrap sequence
├── templates/                   # Reusable document formats
│   ├── session_log.md           #   Session documentation
│   ├── validation_report.md     #   Quality assessment format
│   ├── developer_handoff.md     #   Integration guide format
│   ├── asset_workbook.md        #   Generation tracking
│   └── project_brief.md         #   New project initialization
├── projects/                    # Project-specific bindings
│   └── summoning-chamber/       #   First project (Lands, Classes, learnings)
├── examples/                    # Worked examples
│   └── summoning_chamber_mvp/   #   MVP generation scripts, manifest, patterns
├── output/
│   └── asset_catalog.md         # Approved asset registry
└── docs/
    └── AGENT_SDK_ASSESSMENT.md  # Claude Agent SDK architecture plan
```

**Framework** lives in `core/`, `tools/`, `templates/`. Swap `projects/` for a different domain. Replace `CLAUDE.md` for a different persona.

## Tools

| Tool | Path | Purpose |
|------|------|---------|
| `vga_validate.py` | `tools/pixel_art/` | VGA compliance checker — hard edges, dithering, ≤256 colors, flat lighting |
| `vga_normalize.py` | `tools/pixel_art/` | Post-processing pipeline to enforce VGA standards |
| `png_validate.py` | `tools/pixel_art/` | PNG color mode validator (indexed P/PA vs RGB/RGBA) |
| `palette_check.py` | `tools/pixel_art/` | Palette compliance against Land-specific color definitions |
| `retro_diffusion.py` | `tools/api/` | Retro Diffusion API client — generate, edit, check credits |
| `asset_inventory.py` | `tools/inventory/` | Asset catalog scanner and categorizer |
| `inventory_verify.py` | `tools/inventory/` | Quick asset directory scanner and counter |

All tools are standalone scripts with `--help` documentation. No package installation required beyond `requirements.txt` dependencies (Pillow, numpy, httpx).

### Tool Usage Examples

```bash
# Validate a single asset
python tools/pixel_art/vga_validate.py output/seelie_scryer_backdrop_v1.png

# Batch validate all assets in a directory
python tools/pixel_art/vga_validate.py --batch output/backdrops/

# Check palette compliance for a Land
python tools/pixel_art/palette_check.py output/sprite.png --land seelie_groves

# Verify PNG color mode (indexed vs RGB)
python tools/pixel_art/png_validate.py output/sprite.png

# Scan asset inventory
python tools/inventory/asset_inventory.py output/
```

## Operational Modes

The Art Director persona operates in four modes, defined in `CLAUDE.md`:

| Mode | Trigger | What Happens |
|------|---------|-------------|
| **GENERATE** | "Generate a prompt for..." | Reads domain knowledge, applies learnings, outputs copy-paste prompt |
| **CRITIQUE** | "Critique this output..." | Checks against style guide, palette, VGA rules; structured verdict |
| **REFINE** | "Refine/fix the prompt..." | One significant change per iteration, preserves what works |
| **CATALOG** | "Catalog this as..." | Appends to asset catalog, creates session log, updates learnings |

## Generation Pipeline

```
Prompt Generation ──→ Image Generation ──→ Validation ──→ Refinement ──→ Catalog
     (Limner)       (Retro Diffusion)    (Python tools)    (Limner)     (Limner)
```

**Generation tool:** Retro Diffusion API (native pixel art diffusion model)
- Native grid-aligned pixels — no downsampling or post-hoc dithering
- Palette enforcement at generation time via `input_palette` parameter
- Reference images (up to 9) for character consistency across variants
- Multiple tiers: RD_PRO ($0.22/img), RD_PLUS ($0.025-0.05), RD_FAST ($0.015-0.025)

**Previous tool:** MidJourney (historical learnings preserved in `reference/learnings.md`)

## The Learnings System

Limner's competitive advantage is accumulated empirical knowledge about what generation tools actually respond to.

**Before generating:** Read `reference/learnings.md` and project-specific patterns. Apply known-good patterns, avoid known-bad.

**After approval:** Update learnings with new discoveries — specific phrases that fixed problems, terms that caused issues, parameter values that worked, surprising failures.

**What to capture:** Confirmed facts only. No speculation, no obvious stuff, no one-off flukes.

The learnings file is institutional memory. It grows more valuable with every session.

## Using Limner with Other Systems

**Claude Agent SDK:** Use `CLAUDE.md` as `system_prompt`, register tools as MCP server or custom tools, feed `reference/` as file context. See the architecture assessment in `docs/`.

**Claude Projects:** Add `CLAUDE.md` + `reference/` contents as project knowledge. Persona activates automatically.

**CrewAI / LangChain / AutoGen:** Use `CLAUDE.md` as the agent's system prompt. Feed `reference/` files as RAG context. Tools in `tools/` are standalone scripts callable from any framework.

**Raw system prompts:** `CLAUDE.md` is self-contained. It references files by relative path — provide those files as context alongside the prompt.

**MCP servers:** The Python tools can be wrapped as MCP tool endpoints. Each accepts file paths as arguments and returns structured output.

## Summoning Chamber

The first project built with Limner is **Summoning Chamber** — a VGA-era pixel art RPG interface for assembling AI agents. Think *Darklands* (1992) meets modern agent orchestration.

- 773+ assets generated across 17+ sessions
- 10 Lands of Origin, each with unique palettes and heraldry
- 11 Character Classes with environment-specific props
- 3 custom Retro Diffusion style streams (atmospheric, clean, hybrid)
- Modular paper-doll character system with Land-driven body parts and Class-driven accessories
- 7-layer scene composition architecture
- Live at [summoning-chamber.pages.dev](https://summoning-chamber.pages.dev)

Project-specific files live in `projects/summoning-chamber/`. The primary learnings file — `projects/summoning-chamber/learnings/GENERATION_PATTERNS.md` — contains 17 sessions of empirical generation knowledge.

## For FM Collaborators

If you're an AI model working with this repo for the first time:

1. **Read `CLAUDE.md` first.** It defines your persona, operational modes, and response formats.
2. **Read `reference/style_guide.md`** before generating any prompt. These are the visual rules.
3. **Read `reference/learnings.md`** before every generation session. This is institutional knowledge about what actually works.
4. **Read the Land/Class files** (`reference/lands.md`, `reference/classes.md`) for the specific asset you're working on.
5. **Update `reference/learnings.md`** after any approved asset. Capture what you discovered.
6. **Use the tools.** `tools/pixel_art/vga_validate.py` is your quality gate. Run it.

The `core/` directory contains framework documentation for specific workflows (generation, validation, optimization, handoff). Read the relevant workflow doc when you need it.

## For Human Collaborators

This repo is designed for human-AI collaborative art direction. The human provides creative direction and approval; the AI (Limner persona) handles prompt engineering, style compliance, and catalog management.

**Typical session:**
1. Human describes desired asset
2. Limner generates optimized prompt (GENERATE mode)
3. Human runs prompt through Retro Diffusion (or Limner does via API)
4. Limner critiques output (CRITIQUE mode)
5. Iterate until approved (REFINE mode)
6. Limner catalogs approved asset (CATALOG mode)

**Adding a new project:** Create a directory in `projects/` following the Summoning Chamber structure. Add a project-specific `CLAUDE.md` if needed, or modify the root one.

**Adding a new persona:** Create a new `CLAUDE.md` defining identity, modes, and formats. Reuse `core/`, `tools/`, and `templates/`. The framework is persona-agnostic.

## Development

```bash
# Setup
cd limner
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Lint
pip install ruff
ruff check .

# Run validation smoke tests
python tools/pixel_art/vga_validate.py --help
python tools/api/retro_diffusion.py --help
python tools/inventory/asset_inventory.py --help
```

CI runs on push/PR to `main`: ruff lint, tool smoke tests, palettes.json validation. See `.github/workflows/validate.yml`.

## Documentation

- **This repo:** Framework docs in `core/`, templates in `templates/`, project docs in `projects/`
- **Design documents:** `reference/Summoning_Chamber_Master_Design_Document.md`, `reference/Summoning_Chamber_Land_of_Origin_Codex_FINAL.md`
- **Architecture:** `docs/AGENT_SDK_ASSESSMENT.md` — plan for Claude Agent SDK formalization
- **Notion wiki:** [Workspace Root](https://www.notion.so/Workspace-Root-326e75a69b7e80a58a36d1e410009f44)

## License

[MIT](LICENSE) &copy; 2026 Vinson Consulting

---

*The illuminator prepares their workshop. The first stroke is the truest.*

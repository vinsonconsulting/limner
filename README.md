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
[![Built with Claude Code](https://img.shields.io/badge/Built_with-Claude_Code-blueviolet)](https://claude.ai/code)

*Limner (n.) — A medieval painter of illuminated manuscripts. The craftsperson who renders the visual language.*

---

## What Is This?

Limner is a framework for defining **agent personas** ("persons") that work across any FM system — Claude Projects, CrewAI, custom applications, MCP servers, or raw system prompts. It provides the structure, tools, templates, and accumulated learnings that any persona can use.

The first persona built on this framework is an **Art Director for VGA-era pixel art**, battle-tested through 17 generation sessions producing 773+ assets for the [Summoning Chamber](https://summoning-chamber.pages.dev) project. Its visual north star is *Darklands* (1992). Its tools are sharp. Its opinions about dithering are strong.

## The Person Schema

A "person" (agent persona) is defined through layered architecture:

| Layer | What It Contains | Example (Limner Art Director) |
|-------|-----------------|------------------------------|
| **Identity** | Name, role, metaphor, voice | "Limner — medieval illuminator. Art Director." |
| **Domain Knowledge** | Reference docs the persona consumes | Style guide, Land palettes, Class environments |
| **Tools** | Scripts/APIs the persona can invoke | VGA validation, palette checking, Retro Diffusion API |
| **Learnings** | Accumulated empirical knowledge | What generation tools actually respond to |
| **Workflows** | End-to-end processes | Generate &#8594; Validate &#8594; Refine &#8594; Catalog |
| **Templates** | Reusable document formats | Session logs, validation reports, handoffs |
| **Project Bindings** | Project-specific context | Summoning Chamber Lands, Classes, assets |

The schema is implicit in the directory structure. Formalization (likely JSON Schema) comes after the second persona proves the pattern.

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

### For the Python tools

```bash
pip install -r requirements.txt
python tools/pixel_art/vga_validate.py path/to/image.png
```

## Repository Structure

```
limner/
├── CLAUDE.md                    # Persona instructions (read automatically by Claude)
├── reference/                   # Domain knowledge
│   ├── style_guide.md           #   VGA-era visual rules
│   ├── lands.md                 #   10 Lands with palettes & heraldry
│   ├── classes.md               #   11 Classes with environments & props
│   ├── prompt_templates.md      #   Generation prompt structures
│   └── learnings.md             #   Accumulated generation insights
├── core/                        # Framework documentation
│   ├── generation/              #   API patterns, style presets, letterboxing
│   ├── validation/              #   VGA compliance, palette enforcement
│   ├── optimization/            #   Indexed color, file size, cleanup
│   └── workflows/               #   Post-generation, handoff, inventory
├── tools/                       # Python utilities
│   ├── pixel_art/               #   VGA validation & normalization
│   ├── api/                     #   Retro Diffusion API client
│   ├── inventory/               #   Asset inventory & verification
│   └── config/                  #   Palette definitions (palettes.json)
├── scripts/                     # Project-level automation
│   ├── generate_scene.py        #   Scene/environment generator
│   └── rd_bootstrap.py          #   Cold-start bootstrap sequence
├── templates/                   # Reusable document formats
│   ├── session_log.md           #   Session documentation
│   ├── validation_report.md     #   Quality assessment
│   ├── developer_handoff.md     #   Integration guide
│   ├── asset_workbook.md        #   Generation tracking
│   └── project_brief.md         #   New project initialization
├── projects/                    # Project-specific bindings
│   └── summoning-chamber/       #   First project (Lands, Classes, learnings)
├── examples/                    # Worked examples
│   └── summoning_chamber_mvp/   #   MVP generation scripts & manifest
└── output/
    └── asset_catalog.md         # Approved asset registry
```

**Framework** lives in `core/`, `tools/`, `templates/`. Swap `projects/` for a different project. Replace `CLAUDE.md` for a different persona.

## Tools

| Tool | Path | Purpose |
|------|------|---------|
| `vga_validate.py` | `tools/pixel_art/` | VGA compliance checker (hard edges, dithering, flat lighting) |
| `vga_normalize.py` | `tools/pixel_art/` | Post-processing pipeline to VGA standards |
| `png_validate.py` | `tools/pixel_art/` | PNG color mode validator (indexed vs RGB/RGBA) |
| `palette_check.py` | `tools/pixel_art/` | Palette compliance against Land-specific colors |
| `retro_diffusion.py` | `tools/api/` | Retro Diffusion API client for image generation |
| `asset_inventory.py` | `tools/inventory/` | Asset catalog scanner and categorizer |
| `inventory_verify.py` | `tools/inventory/` | Quick asset directory scanner |

All tools are standalone scripts. No package installation required beyond `requirements.txt` dependencies.

## Using Limner as a Claude Project

1. Create a new Claude Project
2. Add `CLAUDE.md` as project knowledge
3. Add the contents of `reference/` as project knowledge
4. Start a conversation — Claude now has the Limner persona

The persona activates automatically. `CLAUDE.md` defines operational modes (GENERATE, CRITIQUE, REFINE, CATALOG) and response formats.

## Using Limner with Other Systems

**CrewAI / LangChain:** Use `CLAUDE.md` as the agent's system prompt. Feed `reference/` files as RAG context. The tools in `tools/` work as standalone scripts callable from any agent framework.

**Raw system prompts:** `CLAUDE.md` is a self-contained system prompt. It references files by path — provide those files as context alongside the prompt.

**MCP servers:** The Python tools can be wrapped as MCP tool endpoints. Each accepts file paths as arguments and returns structured output.

## Summoning Chamber

The first project built with Limner is **Summoning Chamber** — a VGA-era pixel art RPG interface for assembling AI agents. Think *Darklands* (1992) meets modern agent orchestration.

- 773+ assets generated across 17 sessions
- 10 Lands of Origin, each with unique palettes and heraldry
- 11 Character Classes with environment-specific props
- 3 custom Retro Diffusion styles (atmospheric, clean, hybrid)
- Live at [summoning-chamber.pages.dev](https://summoning-chamber.pages.dev)

Project-specific files live in `projects/summoning-chamber/`. The primary learnings file — `projects/summoning-chamber/learnings/GENERATION_PATTERNS.md` — contains 17 sessions of empirical generation knowledge.

## Documentation

Full documentation, design documents, and architectural decisions live in the [Notion wiki](https://www.notion.so/Workspace-Root-326e75a69b7e80a58a36d1e410009f44).

## License

[MIT](LICENSE) &copy; 2026 Vinson Consulting

---

*The illuminator prepares their workshop. The first stroke is the truest.*

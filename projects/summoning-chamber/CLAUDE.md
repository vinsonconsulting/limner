# Summoning Chamber — Limner Project Brief

You are Limner, generating VGA-era pixel art assets for **Summoning Chamber**, a fantasy-themed AI agent creation tool. This project uses the Retro Diffusion API to create authentic 1990-1993 DOS game aesthetics.

## Project Overview

Summoning Chamber presents 10 distinct **Lands** (AI providers) each with unique denizens, palettes, and aesthetics. Users select from 11 **Classes** (agent roles) with themed environments, then assemble agents via an RPG character sheet metaphor and interact with them in VGA-styled scenes.

**Framework**: SvelteKit
**Display Target**: 1920×1080 composited from pipeline-processed assets
**Aesthetic Era**: 1990-1993 VGA DOS games (Darklands primary, Hillsfar secondary)
**Tool**: Retro Diffusion API (native pixel art generation)

## Core Capabilities (Reference)

All technical workflows live in the core capabilities library. Reference these documents for implementation details:

### Validation
- **Palette Compliance**: `../../core/validation/palette_compliance.md`
- **VGA Compliance**: `../../core/validation/vga_compliance.md`
- **Asset Inventory**: `../../core/validation/asset_inventory.md`
- **Quality Gates**: `../../core/validation/quality_gates.md`

### Generation
- **Style Presets**: `../../core/generation/style_presets.md`
- **Prompt Patterns**: `../../core/generation/prompt_patterns.md`
- **Reference Images**: `../../core/generation/reference_images.md`
- **Resolution Strategies**: `../../core/generation/resolution_strategies.md`

### Optimization
- **Color Mode**: `../../core/optimization/color_mode.md`
- **File Size**: `../../core/optimization/file_size.md`
- **Directory Structure**: `../../core/optimization/directory_structure.md`

### Workflows
- **Post-Generation Validation**: `../../core/workflows/post_generation_validation.md`
- **Developer Handoff**: `../../core/workflows/developer_handoff.md`
- **Asset Inventory**: `../../core/workflows/asset_inventory.md`

## Domain Specifications (Summoning Chamber)

### Lands (10 AI Providers)

Complete specifications in `domain/lands.md`:

1. **Seelie Groves** (Anthropic) — Organic Art Nouveau, silver accents, warm amber lighting
2. **Freemark Reaches** (OpenAI) — Practical timber/steel, warm daylight
3. **Ironroot Holdings** (Google) — Massive stone/copper, forge glow
4. **Shire of Many Hearths** (Ollama) — Round warm cozy, hearth light
5. **Vaults of Précieux** (Mistral) — Clockwork brass/gems, warm lamplight
6. **Fenward Commons** (Together AI) — Murky green swamp, foggy torchlight
7. **Mire of Grok** (xAI) — Toxic green bone brutal, bioluminescent
8. **Scoria Warrens** (Cohere) — Desert tan/bronze, harsh sun/cool underground
9. **Temple of Frozen Thought** (Perplexity) — Ice blue minimalist, diffused cool light
10. **Bottomless Satchel** (Groq) — Purple void ethereal, inner glow

**Critical Constraint**: All Land palettes filtered through **Dark Palette Standard**:
- "very dark", "blackened", "grim medieval", "weathered worn"
- Even warm Lands are warm but **dim**, not warm and bright

Each Land has:
- 9-color palette (hex codes in lands.md)
- Style keywords for prompt construction
- Lighting specifications
- Material descriptions

### Classes (11 Agent Roles)

Complete specifications in `domain/classes.md`:

1. **Scryer** — Vision/analysis, divination tools
2. **Magister** — Knowledge/teaching, library setting
3. **Hammerer** — Building/crafting, forge/workshop
4. **Craftsman** — Making/repairing, artisan workspace
5. **Diplomat** — Negotiation/mediation, elegant meeting room
6. **Herald** — Communication/messaging, dispatch center
7. **Warden** — Protection/security, armory/guard post
8. **Counselor** — Guidance/wisdom, contemplative space
9. **Merchant** — Trade/exchange, marketplace stall
10. **Seneschal** — Organization/management, administrative office
11. **Bard** — Stories/entertainment, performance corner

Each Class has:
- Furniture theme
- Equipment focus
- Specific furniture item list (for overlay generation)
- Accessories worn by characters

### Denizens (10 Character Types)

Complete specifications in `domain/denizens.md`:

| Denizen | Land | Height | Width | Proportions | Key Features |
|---------|------|--------|-------|-------------|--------------|
| Elves | Seelie Groves | 110% | 85% | Tall, slender, elegant | Pointed ears, graceful posture |
| Humans | Freemark Reaches | 100% | 100% | Standard heroic | Balanced, practical |
| Dwarves | Ironroot Holdings | 75% | 120% | Stocky, broad | Barrel chest, short legs |
| Smallfolk | Shire Hearths | 60% | 90% | Short, rounded | Rounded features, warm |
| Gnomes | Vaults Précieux | 55% | 80% | Small, large head | Oversized head, clever eyes |
| Goblins | Fenward Commons | 70% | 75% | Wiry, angular | Sharp features, scrappy |
| Orcs | Mire Grok | 130% | 140% | Massive, brutish | Tusks, powerful build |
| Scalekind | Scoria Warrens | 95% | 90% | Lean, reptilian | Scaled skin, tail |
| Monks | Temple Frozen | 100% | 95% | Standard, austere | Simple robes, calm posture |
| Spirits | Bottomless Satchel | 100% | 100% | Ethereal | Translucent, inner glow |

**Silhouette Test**: Every denizen must be identifiable from silhouette alone at 50% scale.

## Character Generation Strategy

Characters use **full sprites** (not paperdoll compositing):

### Tiered Approach
- **Tier 1 (MVP)**: 10 canonical characters (1 per Land, each different class) → 10 sprites
- **Tier 2**: Popular class variants for high-traffic Lands → 20-30 sprites
- **Tier 3**: Full matrix (all 110 denizen × class combinations) → post-launch

### Reference Image Consistency
RD_PRO supports up to 9 reference images. Use approved canonical sprites as references when generating class variants for the same denizen to maintain:
- Facial features
- Body proportions
- Color palette
- Denizen-specific characteristics

## Empirical Knowledge (Learnings)

### Generation Patterns
Complete session logs in `learnings/GENERATION_PATTERNS.md`:
- Historical Recraft API patterns (Sessions 1-3)
- Current Retro Diffusion workflows (Sessions 4+)
- Style preset mappings (atmospheric, clean, hybrid streams)
- Prompt patterns with proven results
- Critical keyword discoveries
- Session-by-session results (what worked, what didn't)

### Budget Analysis
Complete inventory in `learnings/ASSET_WORKBOOK.md`:
- 545 assets deployed
- $43.70 spent across 12 sessions
- 90%+ success rate
- Cost optimizations discovered
- Quality validation results

### Critical Discoveries

**Keyword Sensitivity** (from GENERATION_PATTERNS.md Session 10):
- ❌ **"cozy"** → Triggers JRPG/storybook aesthetic (avoid)
- ❌ **"golden hour"** → Triggers bright romantic lighting (avoid)
- ✅ **"weathered worn"** → Maintains grim medieval tone
- ✅ **"dim torch glow"** → Preserves dark but warm lighting
- ✅ **"blackened interior"** → Enforces Dark Palette Standard
- ✅ **"ancient cluttered"** → Avoids cuteness signal

**Letterboxing Technique** (Session 10):
- RD_PRO max resolution 512×512 with reference images
- Generate at 256×256 square
- Composite onto 480×270 canvas with dark background RGB(20,18,15)
- Upscale 4× to 1920×1080 via nearest-neighbor
- Bonus: Side areas (420px × 1080px each) become natural UI zones

**3-Reference Image Strategy** (Session 10):
- Land backdrop (environment style/mood)
- Character sprite (denizen appearance)
- Class overlay (furniture arrangement guide)
- All 3 together maintain visual coherence

## Asset Organization

```
static/assets/
├── ui/          # Chrome, buttons, forms, panels, navigation, chat
├── lands/       # {land-name}/backdrop.png, crest.png, crest-small.png
├── classes/     # {class}/overlay.png, icon.png, accessories/
├── characters/
│   ├── sprites/   # {denizen}-canonical.png (128×192, Sprint 2)
│   └── portraits/ # {denizen}-portrait.png (96×96, Sprint 2)
├── scenes/      # {land}-{class}.png (pre-composed master scenes)
├── objects/     # Equipment objects (96×96, clickable)
├── icons/       # demeanor/, nature/, equipment/, classes/, status/, tools/, actions/
├── map/         # base, labels, border, compass, regions/
└── environments/ # summoning-chamber.png, council-chamber.png
```

**Removed (2026-03-09)**: `props/` (orphaned duplicates of `icons/`), `equipment/` (empty), paper doll parts from `characters/` (vXX hold — preserved in git history).

## Workflow (Standard Process)

1. **Consult domain specs** — Read relevant Land/Class/Denizen specs
2. **Check learnings** — Read GENERATION_PATTERNS.md for proven prompts and failures
3. **Select stream** — Determine atmospheric/clean/hybrid based on asset type
4. **Select style preset** — Choose correct RD preset (reference core/generation/style_presets.md)
5. **Prepare palette** — Encode Land palette as base64 for `input_palette` parameter
6. **Prepare references** — Gather approved reference images for consistency
7. **Generate** — Call RD API with style preset + palette + references + prompt
8. **Validate** — Run quality gates (reference core/validation/)
9. **Document** — Record result in GENERATION_PATTERNS.md (success or failure)
10. **Iterate** — If rejected, identify which constraint failed before retrying (max 3 attempts)

## Quality Gates (Every Asset Must Pass)

Reference `core/validation/quality_gates.md` for complete checklist.

**Critical Gates**:
- [ ] True pixel grid alignment (no mixels)
- [ ] No smooth gradients (dithered or flat only)
- [ ] Hard edges on all shapes (no anti-aliasing)
- [ ] Correct Land palette compliance
- [ ] Dark Palette Standard maintained
- [ ] Silhouette readable at 50% scale (characters/props)
- [ ] Transparent backgrounds have clean pixel edges (no fringe)
- [ ] Overall "1992 DOS game" impression

**Validation Commands**:
```bash
# Land palette compliance (from summoning-chamber repo)
python scripts/check_palette.py path/to/asset.png --land seelie_groves

# VGA compliance
python scripts/validate_asset.py path/to/asset.png

# Batch validate
python scripts/validate_asset.py --batch path/to/directory/
```

## When You're Stuck

1. Read rejection feedback — identify specific failed constraint
2. Check `learnings/GENERATION_PATTERNS.md` for similar failures
3. Verify style preset is correct (reference `core/generation/style_presets.md`)
4. Check prompt against `core/generation/prompt_patterns.md`
5. Try `bypass_prompt_expansion: true` if RD over-interpreting
6. Try alternate style preset within same stream
7. Try fundamentally different prompt approach (don't just retry)
8. Document failure pattern in GENERATION_PATTERNS.md
9. After 5 total attempts, escalate with details

## Project Status (as of Session 13)

**MVP Asset Generation**: ✅ COMPLETE (545 assets deployed)
- 10 Master scenes @ 1920×1080
- 161 icons (inventory, heraldic, status, tools, actions)
- 60 UI components
- 16 map assets
- 10+ character sprites (Tier 1 canonical + variants)

**Current Phase**: Post-MVP optimization, UI integration, developer handoff

**Reference Documents in Summoning Chamber Repo**:
- `/docs/STYLE_BRIEF.md` — Hybrid style rules, layer model
- `/docs/VISUAL_STYLE_GUIDE.md` — VGA rules, forbidden elements
- `/docs/LIMNER_BRIEF.md` — Full art direction (legacy)
- `/docs/GRAPHIC_ASSETS.md` — Complete asset manifest
- `/docs/DEV_HANDOFF.md` — UI integration guide
- `/docs/ASSET_OPTIMIZATION_REPORT.md` — Post-generation analysis

## Context Management

### When to /clear
- Switching between Lands (different palettes)
- Switching between streams (atmospheric → clean → hybrid)
- After 5 consecutive generations even if same type
- When approaching context limits

### Fresh Context Protocol
1. `/clear`
2. Read relevant domain specs (lands.md, classes.md, denizens.md)
3. Load GENERATION_PATTERNS.md for this asset type
4. Determine stream and style preset
5. Prepare Land palette and reference images
6. Generate → Validate → Document

---

**Remember**: This CLAUDE.md provides Summoning Chamber context. All technical workflows live in `../../core/`. When implementing generation, validation, or optimization, always reference the appropriate core capability document.

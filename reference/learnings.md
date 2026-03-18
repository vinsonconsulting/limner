# Limner's Learnings

> Institutional knowledge from MidJourney sessions (historical). Read before generating prompts. Update after approvals.

**⚠️ TOOL TRANSITION (Feb 2026):** Limner now uses **Retro Diffusion API** for all production asset generation. This file contains MidJourney patterns for reference. **Active learnings are in [summoning-chamber/docs/GENERATION_PATTERNS.md](../../../summoning-chamber/docs/GENERATION_PATTERNS.md)** (Sessions 1-13).

### Why Retro Diffusion?
- **Native pixel art generation** — true grid-aligned pixels, no downsampling
- **Built-in style presets** — `rd_pro__fantasy`, `rd_plus__skill_icon`, `rd_fast__ui`
- **Palette enforcement** — `input_palette` parameter enforces Land colors at generation time
- **Reference images** — up to 9 reference images for character consistency
- **Transparent backgrounds** — `remove_bg` produces clean sprites natively
- **Cost efficiency** — $0.15-0.22 per image vs MidJourney subscription

### Retro Diffusion Quick Reference
For detailed patterns, see [GENERATION_PATTERNS.md](../../../summoning-chamber/docs/GENERATION_PATTERNS.md) in summoning-chamber repo.

**Stream A (Atmospheric):** `rd_pro__fantasy` or `rd_pro__horror` for backdrops/environments
**Stream B (Clean):** `rd_pro__default` or `rd_pro__simple` for characters/props
**Stream C (Hybrid):** `rd_pro__fantasy` or `rd_fast__ui` for furniture/UI

**Session 13 Key Learnings (Post-MVP Validation):**
- Color **mode** (P vs RGB/RGBA) is storage optimization, separate from palette **compliance**
- SvelteKit requires `image-rendering: pixelated; crisp-edges;` CSS for VGA preservation
- Scene file naming: `{land_underscore}-{class}.png` (e.g., `seelie_groves-scryer.png`)
- Spot-checking methodology: 7 representative assets across categories validates 545-asset inventory
- Virtual environment (`.venv`) required for Python validation scripts with Pillow dependency

---

## MidJourney Patterns (Historical Reference)

Below are learnings from MidJourney sessions. These patterns may not directly translate to Retro Diffusion API.

---

## How to Use This File

**Before generating:** Scan relevant sections for what's worked before.

**After approval:** Add a bullet under the appropriate heading with the insight.

Keep entries concise. Focus on *surprising* learnings, not obvious stuff.

---

## MidJourney Version

**Current Version:** V7 (as of 2025)

### V7 Notes
- V7 is reported to have improved prompt understanding and coherence
- Style anchors from V5/V6 may behave differently — validate during initial sessions
- `/describe` feature available for analyzing reference images
- `--sref` (style reference) and `--cref` (character reference) still supported

### Validation Needed
The following style anchors were documented for earlier versions and need V7 validation:
- [ ] `"Floyd-Steinberg dithering"` — does V7 interpret this correctly?
- [ ] `"320x200 aesthetic upscaled"` — still triggers VGA era?
- [ ] `"hand-pixeled appearance"` — still effective?
- [ ] `"visible pixels"` — still prevents smoothing?
- [ ] `"flat VGA lighting"` — still fixes modern lighting?

**Priority:** Run `/describe` on Darklands screenshots early to establish V7's vocabulary for this aesthetic.

### V7 Keywords to Test
Based on V7's reported improvements, try these alternatives:
- `"DOS VGA game screenshot"` — more literal than "inspired"
- `"256 color palette"` — explicit color count
- `"pixel dithering pattern"` — more specific than Floyd-Steinberg
- `"EGA/VGA era graphics"` — bracketing the era
- `"1990-1993 PC game art"` — date range instead of single year

### Reference Images to Collect
For `/describe` analysis, gather screenshots from:
- **Darklands** — character portraits, interior scenes, world map, combat, UI
- **Quest for Glory** (VGA versions) — character close-ups, room scenes
- **Ultima VII** — inventory screens, interior environments
- **Indiana Jones: Fate of Atlantis** — dialogue scenes, UI panels
- **Eye of the Beholder** — dungeon environments (if darker aesthetic needed)
- **Lands of Lore** — character portraits, rich environments

---

## VGA Style Anchors

### What Works
- `"flat VGA lighting"` — Key phrase to fix modern soft lighting
- `"Floyd-Steinberg dithering"` — MidJourney understands this better than just "dithered"
- `"hand-pixeled appearance"` — More effective than "pixel art" alone
- `"320x200 aesthetic upscaled"` — Triggers the right era better than resolution alone
- `"visible pixels"` — Essential; without it, output often looks smoothed

### What Fails
- `"retro"` alone — Too vague, gets wrong eras
- `"8-bit"` — Wrong era (NES, not VGA)
- `"16-bit"` — Gets SNES/Genesis, closer but still wrong
- `"pixel art"` alone — Often produces modern indie pixel art aesthetic
- `"vintage game"` — Too broad

---

## Negative Prompts (--no)

### Essential (always include)
- `smooth gradients` — The #1 problem
- `modern lighting` — Catches most contemporary rendering
- `photorealistic` — Prevents drift toward realism
- `3D render` — Stops volumetric look

### Situational (add when needed)
- `ambient occlusion` — When soft shadows appear
- `soft shadows` — Explicit version of above
- `ray tracing` — For interior lighting issues
- `neon colors` — When palette is oversaturated
- `anime` — When character faces drift stylistically
- `lens flare` — For outdoor scenes

---

## By Land

### The Seelie Groves
<!-- Add learnings specific to Seelie Groves visuals here -->

### The Freemark Reaches
<!-- Add learnings specific to Freemark Reaches visuals here -->

### The Ironroot Holdings
<!-- Add learnings specific to Ironroot Holdings visuals here -->

### The Shire of Many Hearths
<!-- Add learnings specific to Shire of Many Hearths visuals here -->

### The Vaults of Précieux
<!-- Add learnings specific to Vaults of Précieux visuals here -->

### The Fenward Commons
<!-- Add learnings specific to Fenward Commons visuals here -->

### The Mire of Grok
<!-- Add learnings specific to Mire of Grok visuals here -->

### The Scoria Warrens
<!-- Add learnings specific to Scoria Warrens visuals here -->

### The Temple of Frozen Thought
<!-- Add learnings specific to Temple of Frozen Thought visuals here -->

### The Bottomless Satchel
<!-- Add learnings specific to Bottomless Satchel visuals here -->

---

## By Asset Type

### Character Portraits
<!-- Learnings about generating character portraits -->

### Character Full Body
<!-- Learnings about full body character art -->

### Environment Interiors
<!-- Learnings about interior scenes -->

### Environment Exteriors
<!-- Learnings about outdoor/landscape scenes -->

### Props / Objects
<!-- Learnings about individual items -->

### UI Elements
<!-- Learnings about interface chrome -->

### Heraldry / Crests
<!-- Learnings about emblems and badges -->

---

## Palette Control

### Desaturation
<!-- How to control color saturation -->

### Specific Colors
<!-- Color terms that work well -->

---

## Common Problems & Fixes

| Problem | Fix |
|---------|-----|
| Soft shadows | Add `--no soft shadows, ambient occlusion` |
| Oversaturated colors | Prefix colors with "muted" or "desaturated" |
| Smooth gradients | Add `dithered gradients, Floyd-Steinberg dithering` |
| Modern lighting feel | Add `flat VGA lighting, single light source` |
| Wrong pixel density | Emphasize `320x200 aesthetic upscaled, visible pixels` |
| Too much detail | Add `limited detail, bold shapes` |

---

## MidJourney Parameters

### --stylize
- `200` — Cleaner, more literal (good for UI, props)
- `250` — Balanced (default, good for most)
- `300+` — Drifts from VGA aesthetic, avoid

### --ar (Aspect Ratio)
- `1:1` — Portraits, props, crests
- `2:3` — Full body characters
- `16:9` — Environments, scenes

---

## Session Notes

<!-- 
Chronological notes from specific sessions.
Format: [Date] [Asset] — [Key insight]
-->

---

## Modular Asset Generation

### Land Backdrops
<!-- Learnings about generating backdrop layers -->

### Class Furniture Overlays
<!-- Learnings about furniture that composites onto backdrops -->

### Paper Doll Parts
<!-- Learnings about character component generation -->

### Clickable Objects
<!-- Learnings about isolated interactive objects -->

---

## Retro Diffusion API Patterns (Current)

### Session 13 — Post-MVP Validation & Optimization (Feb 15, 2026)

**Context:** First post-generation session focused on quality validation, asset optimization, and developer handoff for 545 deployed assets.

#### Validation Tools Created
- `validate_png_colormode.py` — Checks PNG color mode (indexed vs RGB/RGBA)
- `verify_asset_inventory.py` — Scans deployed assets, generates categorical breakdown

#### Key Technical Discoveries

**Color Mode vs Palette Compliance:**
- Color **mode** (P=indexed vs RGB/RGBA) is a storage optimization concern
- Color **palette** (actual color values) is a VGA compliance requirement
- Both can be correct independently — RGB mode can contain VGA-compliant colors
- Optimization opportunity: Converting RGB → indexed saves 20-30% file size

**File Naming Conventions:**
- **Directories:** kebab-case (e.g., `seelie-groves/`)
- **Scene files:** Mixed naming — `{land_underscore}-{class}.png` (e.g., `seelie_groves-scryer.png`)
- **Class crests:** `{class}-128.png` and `{class}-48.png` (no `-crest` suffix)

**Framework Requirements (SvelteKit):**
- CSS `image-rendering: pixelated; crisp-edges;` critical for VGA preservation
- Master scenes (pre-composed) preferred over layered composition for MVP
- Letterbox design (420px × 1080px side areas) creates natural UI zones

**Python Validation Environment:**
- Virtual environment (`.venv`) required for Pillow-dependent scripts
- macOS uses `python3` command (not `python`)
- Defensive programming needed for file system edge cases

#### Post-Generation Validation Workflow (Reusable)

1. **Directory Structure Audit**
   - Use `find` commands to verify structure
   - Remove duplicates, standardize naming conventions

2. **Color Mode Validation**
   - Run `validate_png_colormode.py` on assets directory
   - Analyze indexed vs RGB/RGBA ratio
   - Document optimization opportunities (non-blocking)

3. **VGA Compliance Spot-Checks**
   - Select representative assets across all categories
   - Run `validate_asset.py` on each
   - Categorize failures as blocking vs non-blocking

4. **Asset Inventory Verification**
   - Run `verify_asset_inventory.py` for complete breakdown
   - Compare against specification
   - Identify gaps, duplicates, inconsistencies

5. **Documentation**
   - Create optimization report
   - Create developer handoff guide
   - Update GENERATION_PATTERNS.md with session learnings

**Commands:**
```bash
source .venv/bin/activate
python scripts/validate_png_colormode.py static/assets
python scripts/verify_asset_inventory.py static/assets
python scripts/validate_asset.py <path>
```

#### Quality Gate Categorization

**Blocking (Must Fix):**
- Smooth gradients on sprites (Stream B assets)
- Anti-aliasing on character edges
- Incorrect Land palette usage
- UI artifacts (text panels, decorative borders)

**Non-Blocking (Optimization):**
- RGB mode instead of indexed (file size optimization)
- Palette violations within 10% tolerance (e.g., 286 colors vs 256 max)
- Smooth gradients on UI components (hybrid stream allows texture)

#### Session 13 Results
- **545 assets validated** across 10 categories
- **531/541 PNGs** use RGB/RGBA mode (optimization opportunity)
- **6/7 categories** passing VGA compliance cleanly
- **10 duplicate backdrops** identified (~500KB savings potential)
- **Zero generation cost** — validation-only session

**For complete Session 13 learnings, see [summoning-chamber/docs/GENERATION_PATTERNS.md](../../../summoning-chamber/docs/GENERATION_PATTERNS.md#session-13--2026-02-15-post-mvp-optimization--developer-handoff)**

---

*Last updated: 2026-02-15*

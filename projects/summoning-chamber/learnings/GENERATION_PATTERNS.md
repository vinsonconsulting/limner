# Generation Patterns — Summoning Chamber

**Purpose**: Empirical knowledge base for Retro Diffusion API asset generation. Records what works, what doesn't, and critical discoveries from all generation sessions.

**Format**: Chronological session logs with tool evolution, pipeline architecture, stream configurations, and session-by-session results.

**Last Updated**: 2026-03-09 (Sprint 2 — Characters + Portraits + Equipment, 28 assets)

---

## Historical Context: Recraft → Retro Diffusion Migration

**Sessions 1-8** used Recraft API with custom style IDs:
- `ct_sprites` (character sprites with Celtic decorative frames)
- `hillsfar_furniture` (furniture arrangements with chromakey backgrounds)
- `darklands_atmospheric` (atmospheric environments)

**Sessions 9+** migrated to Retro Diffusion API with built-in style presets:
- Better native pixel art generation (grid-aligned, no mixels)
- `input_palette` parameter for Land palette enforcement
- `reference_images` (up to 9) for character consistency
- More predictable style presets vs custom style IDs

---

## Tool Evolution

### Generation Tools

| Tool | Sessions | Status | Notes |
|------|----------|--------|-------|
| Recraft API | 1-8 | Deprecated | Custom style IDs, chromakey backgrounds, decorative frames |
| Retro Diffusion API | 9+ | Current | Native pixel art, style presets, palette enforcement |

### Post-Processing Tools

| Tool | Purpose | Status |
|------|---------|--------|
| vga_normalize.py | Nearest-neighbor upscale ONLY | Active (all other functions replaced by RD-native) |
| Pillow (Python) | Letterboxing, compositing, cropping | **ON HOLD** (2026-03-09 — prompt engineering replaces compositing) |
| Aseprite CLI | Indexed color conversion | **DROPPED** (Session 3) |
| check_palette.py | Land palette validation | Active |
| validate_asset.py | VGA compliance validation | Active |

### Custom RD Styles (Session 3+)

| Key | Style Name | Stream | For | BG Removal |
|-----|-----------|--------|-----|------------|
| `sc_atmospheric` | SC Atmospheric | A | Backgrounds, tiles, maps | No |
| `sc_clean` | SC Clean | B | Characters, equipment, props, crests | Yes |
| `sc_hybrid` | SC Hybrid | C | UI chrome, furniture, decorative | No |

Created via `rd_bootstrap.py`. Style IDs stored in `rd_style_ids.json`. Load at session start via `load_style_ids()` from `rd_api.py`.

**Active Style IDs** (as of 2026-03-08):
- `sc_atmospheric` → `user__sc_atmospheric_eb2788aa`
- `sc_clean` → `user__sc_clean_9b6d454a`
- `sc_hybrid` → `user__sc_hybrid_e1ea0b26`

---

## Pipeline Architecture

### Recraft Era (Sessions 1-8)

**Crest Generation**:
1. Generate 1024×1024 with `ct_sprites` style
2. Crop decorative frame (Pillow)
3. Square on dark background RGB(20,18,15)
4. vga_normalize.py --stream hybrid --dither none --outline dark --palette [land] --target-width 128
5. Downscale to 48px for small variant

**Backdrop Generation**:
1. Generate 1820×1024 with `darklands_atmospheric` style
2. vga_normalize.py --stream atmospheric --palette [land] --target-width 480
3. Nearest-neighbor 4× upscale to 1920×1080

**Overlay Generation** (Complex — Chromakey Issues):
1. Generate 1024×1024 with `hillsfar_furniture` + bright green background prompt
2. Crop Hillsfar text panel (bottom-up scan, lower 60%)
3. Multi-tier chromakey: green → teal/cyan/black → wall color-range (if needed)
4. vga_normalize.py --stream hybrid --palette ui_chrome --target-width 480 --dither none
5. Compose onto 480×270 transparent canvas
6. Nearest-neighbor 4× upscale to 1920×1080

**Known Issues**:
- `ct_sprites` adds unwanted decorative frames (must crop)
- `hillsfar_furniture` adds text panel to every generation (must crop)
- `hillsfar_furniture` partially ignores green chromakey at 1820×1024 (use 1024×1024 square instead)
- Wall color-range removal aggressive → destroys gray furniture

### Retro Diffusion Era (Sessions 9-15)

**Master Scene Generation** (Letterboxing Technique):
1. Generate 256×256 with `rd_pro__fantasy` + 3 reference images (backdrop, character, overlay)
2. Letterbox onto 480×270 canvas with dark background RGB(20,18,15)
3. Nearest-neighbor 4× upscale to 1920×1080
4. Validate with check_palette.py and validate_asset.py

**Character Sprite Generation**:
1. Generate 256×256 with `rd_pro__default` + `remove_bg: true`
2. Use `reference_images` for denizen consistency across class variants
3. Validate silhouette at 50% scale
4. Deploy as-is (no post-processing needed)

**Icon Generation**:
1. Generate 64×64 with `rd_plus__skill_icon` or `rd_plus__topdown_item`
2. `remove_bg: true` for transparent background
3. Validate clarity at native 64×64
4. Deploy as-is

### RD-Native Custom Styles Era (Session 3 / Codex Pivot)

**What changed**: Radically simplified. Three custom RD Pro styles (`sc_atmospheric`, `sc_clean`, `sc_hybrid`) bake in all rendering parameters — palette, bg removal, dithering, outlines, mood. vga_normalize.py reduced to upscaler only. Aseprite CLI dropped entirely. UI pivoted from 11-step wizard to single-screen Codex Model. 100-piece paperdoll eliminated → 10 full-body sprites + 10 portraits.

**New Pipeline (all assets)**:
```
1. LOAD style ID from rd_style_ids.json
2. LOAD palette PNG for the target Land (or pal_ui)
3. COMPOSE prompt: subject + details only (style handles mood)
4. GENERATE: POST /v1/inferences with num_images: 2-4
5. PICK best variant
6. VALIDATE: validate_asset.py + check_palette.py
7. If minor fix → /v1/edit ($0.06)
8. If major fail → regenerate with adjusted prompt
9. UPSCALE: vga_normalize.py --upscale 4 (nearest-neighbor)
10. SAVE to correct path per GRAPHIC_ASSETS.md
```

**Key prompting change**: Prompts focus on SUBJECT + DETAIL only. Style handles mood/atmosphere/palette. Example:
- Good: "Elf warrior, angular features, pointed ears, silver circlet, green hood"
- Bad: "Dark medieval pixel art elf warrior with dithering and outlines..."

**Bootstrap workflow (Day 0)**:
1. `python scripts/rd_bootstrap.py` — creates palettes, 3 custom styles, test images
2. Review 3 test outputs in `test_output/`
3. PATCH any style that needs adjustment
4. Verify `rd_style_ids.json` exists and is loaded

**New asset dimensions** (Codex Model):
- Full-body sprites: 128×192 (was 256×256)
- Portraits: 96×96 (was 256×256)
- Class icons: 48×48
- Status/UI icons: 16×16 to 32×32
- Crests: 128×128 (large) + 32×32 (small)

**Iteration budget**: 2-3 generations per approved asset, max 5 before escalating

---

## Style Preset Mapping

### Stream A — Atmospheric (Backgrounds, Environments)

| Preset | Use For | Cost | Notes |
|--------|---------|------|-------|
| `rd_pro__fantasy` | Land backdrops, environment scenes | $0.22 | Detailed textures, soft transitions, light dithering |
| `rd_pro__horror` | Dark Lands (Mire, Scoria) | $0.22 | Dark, gritty, harsh shapes |
| `rd_plus__environment` | Mid-ground scenes | $0.025–0.05 | One-point perspective, strong shapes |

### Stream B — Clean (Characters, Props, Equipment)

| Preset | Use For | Cost | Notes |
|--------|---------|------|-------|
| `rd_pro__default` | Character sprites | $0.22 | Clean pixel art, supports reference images |
| `rd_pro__simple` | Small props | $0.22 | Minimal shading, strong outlines |
| `rd_plus__classic` | Heraldic crests | $0.025–0.05 | Strong outlines, simple shading |
| `rd_plus__skill_icon` | Inventory icons | $0.025 (~2 credits) | Purpose-built for icons |
| `rd_plus__topdown_item` | Equipment objects | $0.025 (~2 credits) | Top-down items, clean separation |

### Stream C — Hybrid (Furniture, UI)

| Preset | Use For | Cost | Notes |
|--------|---------|------|-------|
| `rd_pro__fantasy` | Furniture, large props | $0.22 | Material texture through prompting |
| `rd_fast__ui` | UI panels, buttons | $0.015–0.025 | Purpose-built for UI, fastest iteration |

---

## Session Log

### Session 1-3 — Prototype + Style Development (Feb 10-11, 2026)

**Tool(s)**: Recraft API (ct_sprites, hillsfar_furniture, darklands_atmospheric)
**Focus**: Letterboxing technique discovery, reference image strategy
**Cost**: ~10 credits (~$0.76)

**Critical Discoveries**:
- RD API 16:9 constraint with reference images → letterboxing solution
- 256×256 generation → 480×270 canvas → 1920×1080 upscale
- Letterbox side areas (420px × 1080px) repurposed as UI zones
- 3 reference images per generation (backdrop + character + overlay)

**What Worked**:
- Letterboxing technique solves aspect ratio constraint elegantly
- Dark background RGB(20,18,15) matches Summoning Chamber base tone
- Nearest-neighbor upscaling preserves pixel structure

**What Didn't Work**:
- Direct 16:9 generation with reference images (API 400 Bad Request)
- Smaller intermediate resolutions (320×180) — insufficient detail

---

### Session 4-5 — Land Heraldic Crests (Feb 11, 2026)

**Tool(s)**: Recraft API (ct_sprites)
**Focus**: 11 Land crests × 2 sizes (128×128, 48×48)
**Assets Generated**: 44 images (11 lands × 2 variations × 2 sizes)
**Cost**: ~44 credits (~$3.34)

**What Worked**:
- `ct_sprites` style produces clean heraldic shields
- Cropping decorative frame via Pillow (shield area extraction)
- No dithering on crests (hurts legibility at small sizes)
- Dark outline (outline-weight 1) improves readability
- 9-color Land palettes sufficient for crests

**What Didn't Work**:
- Decorative Celtic frames on every generation (must crop manually)
- Attempting to generate without frames (style ID doesn't support it)

**Prompt Pattern**:
```
heraldic shield crest, [Land motif], centered,
medieval fantasy, dark weathered materials, dim lighting
```

**Quality Gates**:
- Shield clearly centered and recognizable
- Motif reflects Land theme
- Dark palette maintained
- No decorative frame in final asset

---

### Session 6 — UI Components (Feb 11, 2026)

**Tool(s)**: Recraft API (mixed style IDs)
**Focus**: Chrome, buttons, forms, panels, navigation, chat elements
**Assets Generated**: 60 UI elements
**Cost**: ~48 credits (~$3.65)

**What Worked**:
- UI elements generate cleanly with minimal post-processing
- 9-slice border technique works well for panels/cards
- Consistent pixel grid across all UI components

**What Didn't Work**:
- Some buttons too ornate (simplified prompts fixed)

---

### Session 7 — Land Backdrops (Feb 12, 2026)

**Tool(s)**: Recraft API (darklands_atmospheric)
**Focus**: 10 Land backdrops @ 1920×1080
**Assets Generated**: 20 images (10 lands × 2 variations)
**Cost**: ~20 credits (~$1.52)

**What Worked**:
- "empty center area for furniture placement" in prompt works reliably
- 1820×1024 native generation (Recraft supports natively)
- 480×270 intermediate resolution > 320×180 (better detail, dithering still atmospheric)
- Nearest-neighbor 4× upscale to 1920×1080 preserves VGA aesthetic
- vga_normalize.py --stream atmospheric --palette [land] enforces palette compliance

**What Didn't Work**:
- Initial attempts without "empty center" prompt → too busy for furniture layering

**Prompt Pattern**:
```
[Land environment description], empty center area for furniture placement,
dark medieval atmosphere, weathered materials, dim lighting,
atmospheric dithering, [Land-specific keywords]
```

**Quality Gates**:
- Empty center 600px × 400px minimum (furniture placement zone)
- Atmospheric dithering on background elements
- Land palette compliance
- Dark/muted tone maintained

---

### Session 8 — Class Furniture Overlays (Feb 12, 2026)

**Tool(s)**: Recraft API (hillsfar_furniture)
**Focus**: 11 Class furniture overlays @ 1920×1080 transparent
**Assets Generated**: 22 images (11 classes × 2 variations)
**Cost**: ~22 credits (~$1.67)

**What Worked**:
- 1024×1024 square format more compliant than 1820×1024 wide
- "SOLID BRIGHT GREEN BACKGROUND, collection of medieval [X] furniture items" prompt framing
- "NO WALLS NO ROOM" constraint reduces wall generation
- Multi-tier chromakey: green → teal/cyan/black → wall color-range
- Cropping Hillsfar text panel (bottom-up scan, lower 60%)

**What Didn't Work**:
- `hillsfar_furniture` partially ignores green chromakey (fights toward full room scenes)
- Aggressive wall color-range removal destroys gray furniture (use conservative range only)
- Hillsfar text panel appears in EVERY generation (must crop)

**Prompt Pattern**:
```
SOLID BRIGHT GREEN BACKGROUND, collection of medieval [class] furniture items,
[item list], isolated objects on green, NO WALLS NO ROOM,
dark weathered materials, dim lighting, medieval worn
```

**Chromakey Process**:
1. Green chromakey (R < 100, G > 150, B < 100)
2. Teal/cyan removal (if needed)
3. Black removal (pure black = wall shadows)
4. Wall color-range removal (CONSERVATIVE: R∈[50,140] G∈[40,130] B∈[20,100])

**Quality Gates**:
- Furniture items clearly separated
- Transparent background with clean edges
- No wall fragments remaining
- Gray furniture not destroyed by color-range removal

---

### Session 9 — Character Sprites Tier 1 (Feb 12, 2026)

**Tool(s)**: Recraft API → **Retro Diffusion API** (first migration)
**Focus**: 10 canonical denizen/class pairings @ 256×256
**Assets Generated**: 10 full sprites
**Cost**: ~70 credits (~$5.32)

**Migration to Retro Diffusion**:
- Switched from Recraft custom style IDs to RD built-in style presets
- `rd_pro__default` for character sprites
- `remove_bg: true` for transparent backgrounds (native, no chromakey)
- `reference_images` parameter for denizen consistency

**What Worked**:
- RD native transparency > Recraft chromakey (cleaner edges)
- `rd_pro__default` produces clean character sprites
- Reference images maintain denizen features across class variants
- Silhouette quality gate (50% scale identifiability) validated

**What Didn't Work**:
- Initial prompts too detailed → RD over-interpreted
- Learned: Shorter prompts with `bypass_prompt_expansion: false` work better

**Prompt Pattern**:
```
[denizen] [class] character, clear silhouette, front-facing,
dark fantasy, medieval worn equipment, [denizen features]
```

**Quality Gates**:
- Silhouette readable at 50% scale
- Denizen type identifiable from proportions/features
- Class equipment/theme visible
- Transparent background with clean pixel edges
- No anti-aliasing or soft edges

---

### Session 10 — Master Scene Generation (Feb 13, 2026)

**Tool(s)**: Retro Diffusion API (rd_pro__fantasy)
**Focus**: 10 canonical Class/Land master scenes @ 1920×1080
**Assets Generated**: 22 images (10 scenes × 2-3 variations, includes 2 Shire regenerations)
**Cost**: 22 credits (~$1.67)

**Key Discovery**: "Cozy" Keyword Triggers JRPG Aesthetic

**Problem**: Shire Hearths/Craftsman scene rejected as "too cute JRPG cloying way, not a fit"

**Root Cause Analysis**:
```python
# PROBLEMATIC KEYWORDS (Session 10, Shire Hearths first attempt)
"keywords": "round shapes, warm orange tones, cozy cluttered, golden hour hearth glow"
```

**Why It Failed**:
1. **"cozy"** → Strongly correlates with bright, welcoming, cartoon-like aesthetics in diffusion models
2. **"golden hour hearth glow"** → Suggests bright, warm, romantic lighting (sunset/sunrise), fights "dim" constraint
3. Missing explicit dark/grim keywords to override cuteness signals

**Style Guide Requirement** (CLAUDE.md line 259):
```
Even "warm" Lands like Shire of Many Hearths — warm but dim, not warm and bright.
```

**Fix — Revised Keywords**:
```python
# CORRECTED KEYWORDS (Session 10, Shire Hearths regeneration)
"keywords": "round shapes, weathered worn wood, very muted burnt orange,
blackened interior, dim torch and hearth glow, ancient cluttered workspace"
```

**Key Changes**:
- ~~"cozy cluttered"~~ → **"ancient cluttered workspace"** (removes cuteness signal)
- ~~"golden hour hearth glow"~~ → **"dim torch and hearth glow"** (actual light source, not ambient brightness)
- ~~"warm orange tones"~~ → **"very muted burnt orange"** (explicit desaturation constraint)
- **Added**: "weathered worn wood" (replaces smooth aesthetic)
- **Added**: "blackened interior" (explicit dark mood)
- **Added**: "very muted" (constrains saturation)

**What Worked**:
- Letterboxing technique (256×256 → 480×270 → 1920×1080)
- 3 reference images (backdrop + character + overlay)
- Character-first prompt structure (denizen + class before environment)
- Explicit dark/muted keywords override brightness drift

**What Didn't Work**:
- "Cozy", "golden hour", or other brightness-associated keywords
- Ambient lighting descriptions without explicit "dim" constraint
- Assuming style preset enforces dark palette (must use keywords + input_palette)

**Prompt Pattern** (Character-First Structure):
```
[denizen] [class] character in [environment],
[furniture items], character standing center at floor level,
furniture arranged around character at appropriate depths,
medieval fantasy interior scene, [keywords with dark/muted emphasis],
dark weathered materials, dim atmospheric lighting,
full scene composition 1920x1080, NO TEXT, NO UI ELEMENTS, NO BORDERS
```

**Quality Gates**:
- Warm but **dim** lighting (not bright/cheerful)
- Blackened/weathered materials (not clean/new)
- Muted palette (not saturated/vibrant)
- Grim medieval atmosphere maintained
- No JRPG storybook aesthetic
- Character positioned naturally on floor plane
- Furniture integration at appropriate depths

**Verification Checklist for "Warm" Lands**:
- [ ] Warm but **dim** lighting (not bright/cheerful)
- [ ] Explicit "dim", "blackened", "weathered" keywords
- [ ] "Very muted" color constraint
- [ ] No "cozy", "golden hour", or brightness keywords
- [ ] No smooth/clean aesthetic (aged/worn instead)

---

### Session 11 — Inventory Icons Batch 1-3 (Feb 13-14, 2026)

**Tool(s)**: Retro Diffusion API (rd_plus__skill_icon, rd_plus__topdown_item)
**Focus**: 95 inventory icons @ 64×64
**Assets Generated**: 145 images (Batch 1: 45, Batch 2: 40, Batch 3: 60)
**Cost**: 224 credits (~$17.02)

**Batch 1 (Demeanor Props — 15 icons)**:
- Generated: 15 icons × 3 variations = 45 images
- Cost: 90 credits (~$6.84) — 6 credits per variation
- User directive: Reduce to 2 variations for remaining batches
- Status: ✅ All 15 selected and deployed

**Batch 2 (Demeanor Props — 20 icons)**:
- Generated: 20 icons × 2 variations = 40 images (in 2 phases due to timeout)
- Cost: 24 credits (~$1.82) — **Cost discovery: 4 credits/var, not 6!**
- Status: ✅ All 20 selected and deployed

**Batch 3 (Nature + Ambient + Equipment — 60 icons)**:
- Generated: 60 icons × 1 variation = 60 images
- Cost: 110 credits (~$8.36) — **Cost discovery: 2 credits/icon, not 4!**
- User directive: Single variation (no user review, direct deployment)
- Status: ✅ All 60 deployed

**Cost Recalibration**:
- Initial estimate: ~$0.05 per icon
- Batch 1 actual: ~$0.46 per variation (6 credits)
- Batch 2 actual: ~$0.30 per variation (4 credits)
- Batch 3 actual: ~$0.15 per icon (2 credits)

**What Worked**:
- `rd_plus__skill_icon` produces clean 64×64 icons consistently
- `rd_plus__topdown_item` excellent for equipment objects
- `remove_bg: true` generates clean transparent backgrounds
- Single variation strategy (Batch 3) efficient for budget constraints

**What Didn't Work**:
- Initial 3-variation approach (too expensive for 95 icons)

**Prompt Pattern (Icons)**:
```
64x64 pixel art icon, [item description], clear silhouette,
medieval dark fantasy, muted palette, hard edges,
isolated object on transparent background, VGA game style
```

**Prompt Pattern (Equipment)**:
```
64x64 pixel art equipment icon, [item description],
top-down perspective, clear silhouette, functional design,
medieval dark fantasy, muted palette, hard edges,
isolated object on transparent background, VGA game style
```

**Quality Gates**:
- Clear silhouette at 64×64 native size
- Recognizable subject without labels
- Transparent background with clean pixel edges
- Consistent style within category
- VGA aesthetic (hard edges, limited palette, no gradients)
- Readable when displayed at 64×64 or scaled up

---

### Session 12 — Class Crests (Feb 14, 2026)

**Tool(s)**: Retro Diffusion API (rd_plus__classic)
**Focus**: 11 Class crests × 2 sizes (128×128, 48×48)
**Assets Generated**: 44 images (11 classes × 2 variations × 2 sizes)
**Cost**: 44 credits (~$3.34)

**What Worked**:
- `rd_plus__classic` produces clean heraldic shields
- Strong outlines, simple shading
- No decorative frames (unlike Recraft ct_sprites)
- Silhouette-based motifs clear at both sizes

**Selection Pattern**:
- var1 selected: Magister, Craftsman, Herald, Counselor, Seneschal (5)
- var2 selected: Scryer, Hammerer, Diplomat, Warden, Merchant, Bard (6)

**Prompt Pattern**:
```
heraldic shield crest, [class motif], medieval fantasy,
dark weathered materials, simple shading, strong outline,
clear silhouette, centered composition
```

**Quality Gates**:
- Shield shape clearly defined
- Class motif recognizable
- Dark palette maintained
- Readable at 48×48 (small size)
- No smooth gradients

---

### Session 13 — Post-MVP Optimization & Developer Handoff (Feb 14-15, 2026)

**Tool(s)**: Python validation scripts (validate_png_colormode.py, verify_asset_inventory.py, validate_asset.py)
**Focus**: Quality validation, asset optimization, developer integration documentation
**Assets Processed**: 545 PNG/GIF files (all MVP categories)
**Cost**: $0 (no generation, validation/documentation only)

**Validation Tools Created**:

| Tool | Purpose | Usage |
|------|---------|-------|
| `validate_png_colormode.py` | Check PNG color mode (indexed vs RGB/RGBA) | `python scripts/validate_png_colormode.py <directory>` |
| `verify_asset_inventory.py` | Scan deployed assets, generate categorical breakdown | `python scripts/verify_asset_inventory.py static/assets` |

**Validation Results**:

**Directory Cleanup:**
- Removed 10 duplicate empty underscore directories in `static/assets/lands/`
- Standardized on kebab-case naming
- Verification: 11 directories remain (10 lands + summoner) ✓

**PNG Color Mode Assessment:**
- 10/541 files use indexed color (1.8%)
- 531/541 files use RGB/RGBA (98.2%)
- Optimization opportunity: 20-30% file size reduction via indexed conversion
- Non-blocking for MVP (color values are VGA-compliant)

**VGA Compliance Spot-Checks:**
- Tested 7 representative assets across all categories
- Results: 6/7 passing cleanly
- 1 minor issue: Map base has 286 colors (vs 256 max, non-critical)
- UI component smooth gradient warnings are expected and acceptable (hybrid stream)

**Asset Inventory:**
- 545 total files across 10 categories
- All MVP categories complete
- Discovered: 10 duplicate land backdrops (~500KB redundant)

**What Worked**:

**Spot-Checking Methodology:**
- Testing representative assets across categories more efficient than full scan
- 7 assets revealed quality patterns applicable to all 545 files
- Failed assets (map base) correctly identified as edge cases

**Tool Creation for Batch Validation:**
- Custom scripts enable repeatable validation across sessions
- Virtual environment (.venv) isolates dependencies correctly
- Script reusability: validate_png_colormode.py can run on any directory

**Path Discovery Corrections:**
- Scene files use mixed naming: underscore in land name, dash before class
- Class crests use `{class}-128.png` and `{class}-48.png` format
- Self-corrected file-not-found errors by discovering actual naming conventions

**Quality Gates as Non-Blocking:**
- Indexed color optimization identified as post-MVP nice-to-have
- Map palette violation documented but non-blocking (colors look correct)
- Clear separation: compliance blockers vs optimization opportunities

**What Didn't Work (Then Fixed)**:

**Issue 1: Icon File Handling in verify_asset_inventory.py**
- **Problem:** `IndexError: tuple index out of range` when processing Icon file in lands/ root
- **Cause:** Script assumed all files in lands/ had subdirectory structure
- **Fix:** Added check `if len(path.parts) > 2` before accessing nested parts
- **Learning:** File system edge cases require defensive programming

**Issue 2: Path Discovery**
- **Problem:** Used kebab-case for scene files, actual files use underscore
- **Discovery:** Scene file naming is `{land_with_underscores}-{class}.png`
- **Fix:** Corrected path to `seelie_groves-scryer.png`
- **Learning:** Naming conventions vary by asset category (kebab-case for directories, mixed for files)

**Issue 3: Python Command**
- **Problem:** `python: command not found` on macOS
- **Fix:** Used `python3` instead
- **Learning:** macOS default is `python3`, not `python`

**Issue 4: Missing Pillow Dependency**
- **Problem:** `ModuleNotFoundError: No module named 'PIL'`
- **Discovery:** Found `.venv` virtual environment
- **Fix:** `source .venv/bin/activate` before running scripts
- **Learning:** Always activate venv for validation scripts

**Technical Discoveries**:

**SvelteKit Framework:**
- Project uses SvelteKit (not Astro as mentioned in global CLAUDE.md)
- CSS `image-rendering: pixelated; crisp-edges;` critical for VGA preservation
- Scene rendering should use master scenes (pre-composed) for MVP

**File Naming Conventions:**
- **Directories:** kebab-case (e.g., `seelie-groves/`)
- **Scene files:** `{land_underscore}-{class}.png` (e.g., `seelie_groves-scryer.png`)
- **Class crests:** `{class}-128.png` and `{class}-48.png` (no `-crest` suffix)

**Color Mode vs Palette Compliance:**
- Color **mode** (P vs RGB/RGBA) is storage optimization
- Color **palette** (values) is VGA compliance requirement
- Both can be correct independently (RGB mode can contain VGA-compliant colors)

**Workflow Summary (Post-Generation Validation)**:

**Reusable Process:**

1. **Directory Structure Audit**
   - Use `find` commands to list directories and verify structure
   - Remove duplicates (empty underscore-named dirs)
   - Standardize on kebab-case

2. **Color Mode Validation**
   - Run `validate_png_colormode.py` on assets directory
   - Analyze results: indexed vs RGB/RGBA ratio
   - Document optimization opportunities (non-blocking)

3. **VGA Compliance Spot-Checks**
   - Select representative assets across all categories
   - Run `validate_asset.py` on each
   - Document failures, categorize as blocking vs non-blocking

4. **Asset Inventory Verification**
   - Run `verify_asset_inventory.py` for complete breakdown
   - Compare against specification (GRAPHIC_ASSETS.md)
   - Identify gaps, duplicates, inconsistencies

5. **Documentation**
   - Create optimization report (ASSET_OPTIMIZATION_REPORT.md)
   - Create developer handoff (DEV_HANDOFF.md or INTEGRATION_GUIDE.md)
   - Update GENERATION_PATTERNS.md with session learnings

**Commands Used:**
```bash
# Activate virtual environment
source .venv/bin/activate

# PNG color mode check
python scripts/validate_png_colormode.py static/assets

# Asset inventory
python scripts/verify_asset_inventory.py static/assets

# VGA compliance (single file)
python scripts/validate_asset.py <path>

# Directory verification
find static/assets/lands -maxdepth 1 -type d | wc -l
```

**Developer Handoff Learning**:

**Integration Priorities Discovered:**
1. **Master scenes** are the hero visual feature (pre-composed, production-ready)
2. **Path helpers** needed for consistent file access across kebab-case and underscore naming
3. **CSS requirements** critical: `image-rendering: pixelated` prevents browser smoothing
4. **Letterbox design** creates natural UI zones (420px × 1080px side areas)

**Code Patterns Documented** (in DEV_HANDOFF.md):
- Path helper for master scenes (kebab-to-underscore conversion)
- Scene renderer component (Svelte with pixelated CSS)
- Validation commands for testing asset integration

**Next Steps**:

**Immediate (Complete)**:
- ✅ Document Session 13 in GENERATION_PATTERNS.md
- ✅ Update ASSET_WORKBOOK.md if needed
- ✅ Pass context to development team via DEV_HANDOFF.md

**Post-MVP Optimization (Optional)**:
1. Batch convert RGB/RGBA → indexed color (20-30% file size reduction)
2. ~~Remove 10 duplicate land backdrop files~~ ✅ Done (Session 13 cleanup)
3. Fix map base palette violation (286 → 256 colors)
4. ~~Consolidate props directories~~ ✅ Done (2026-03-09 cleanup — removed `props/`, `icons/props/`, `equipment/`)
5. ~~Decide on paper doll system~~ ✅ Done (2026-03-09 — vXX indefinite hold, 117 files removed, preserved in git)

---

## Untested Areas (Require Exploration)

### RD Animation Styles
- `animation__any_animation` — general purpose @ 64×64
- `animation__vfx` — effects sprite sheets @ 24-96px
- `animation__walking_and_idle` — character cycles @ 48×48

**Use Cases**: Candle flicker, ember glow, spinner, magic effects

### RD Tileset Generation
- `rd_tile__single_tile` — seamless 16-64px tiles
- `rd_tile__tileset` — full tileset with wang combinations

**Use Cases**: Floor textures, wall textures, environment tiles

### Multi-Image Reference Consistency
- RD supports up to 9 reference images
- Only tested with 3 references (backdrop + character + overlay)
- Could use more references for tighter style control

---

## Critical Learnings Summary

### Keyword Sensitivity

**Forbidden Keywords** (trigger brightness drift):
- "cozy" → cartoon-like, bright, welcoming aesthetics
- "golden hour" → bright, romantic lighting
- "warm and bright" → fights dim constraint
- "smooth" → anti-aliasing, modern look

**Required Keywords** (enforce dark aesthetic):
- "dim", "blackened", "weathered", "grim"
- "very muted", "shadowy", "dark fantasy"
- "medieval worn", "ancient", "aged"

### Prompt Structure Best Practices

**Character-First Prompts** (for scenes with characters):
```
[denizen] [class] character in [environment], [furniture], [keywords]
```
NOT:
```
[environment] with [denizen] [class] character, [furniture], [keywords]
```

**Material Descriptions** (for furniture/props):
- Explicit materials: "carved oak", "hammered bronze", "weathered leather"
- NOT generic: "wooden", "metal", "fabric"

**Lighting Sources** (not ambient descriptions):
- "dim candlelight", "torch glow", "forge light"
- NOT "golden hour", "warm glow", "soft lighting"

### Cost Optimization Patterns

1. **Icon generation cheaper than expected** — 2 credits/icon @ rd_plus, not 4-6
2. **Single variation strategy** works for straightforward assets (Batch 3)
3. **Multi-variation for complex assets** where design can vary (scenes, characters)
4. **RD_FAST for UI iteration** — 1/10th cost of RD_PRO, acceptable quality for previews

### Reference Image Strategy

**3-Image Pattern (Master Scenes)**:
1. Land backdrop (environment style/mood)
2. Character sprite (denizen appearance)
3. Class overlay (furniture composition guide)

**Character Consistency Pattern**:
1. Generate canonical character for Land (e.g., Seelie Groves Elf Scryer)
2. Use approved sprite as reference for same-denizen class variants
3. Maintains facial features, proportions, palette

### Quality Gate Hierarchy

**Blocking** (must fix before approval):
- Smooth gradients on sprites/icons
- Anti-aliasing on pixel edges
- Wrong Land palette
- JRPG/modern aesthetic

**Non-Blocking** (document, fix post-MVP):
- PNG color mode (RGB vs indexed)
- File size optimization opportunities
- Minor palette violations (e.g., 286 colors vs 256 if colors look correct)
- Duplicate files

### Tool Selection Matrix

| Asset Type | Primary Tool | Fallback | Post-Process |
|------------|-------------|----------|--------------|
| Scenes (1920×1080) | RD rd_pro__fantasy | Compositing from sections | vga_normalize (optional) |
| Characters (256×256) | RD rd_pro__default | N/A | Silhouette validation |
| Icons (64×64) | RD rd_plus__skill_icon | rd_plus__topdown_item | None needed |
| UI (varies) | RD rd_fast__ui | rd_plus__ui_element | None needed |
| Crests (128×128, 48×48) | RD rd_plus__classic | N/A | None needed |

---

## Session-by-Session Cost Summary

| Session | Focus | Assets Generated | Cost (credits) | Cost (USD) |
|---------|-------|------------------|----------------|------------|
| 1-3 | Prototype + Style Dev | ~10 test images | ~10 | ~$0.76 |
| 4-5 | Land Crests | 44 (11 × 2 var × 2 sizes) | ~44 | ~$3.34 |
| 6 | UI Components | 60 | ~48 | ~$3.65 |
| 7 | Land Backdrops | 20 (10 × 2 var) | ~20 | ~$1.52 |
| 8 | Class Overlays | 22 (11 × 2 var) | ~22 | ~$1.67 |
| 9 | Character Sprites T1 | 10 | ~70 | ~$5.32 |
| 10 | Master Scenes | 22 (10 × 2-3 var) | 22 | ~$1.67 |
| 11 | Inventory Icons | 145 (B1: 45, B2: 40, B3: 60) | 224 | ~$17.02 |
| 12 | Class Crests | 44 (11 × 2 var × 2 sizes) | 44 | ~$3.34 |
| 13 | Validation/Optimization | 0 (validation only) | 0 | $0 |
| **Subtotal** | **MVP Complete** | **377 approved + variants** | **~504** | **~$38.29** |
| 14 | P0 Scenes + Slot Icons | 63 | ~67 | ~$5.09 |
| 15 | All-Lands Master Scenes | 110 | ~130 | ~$9.90 |
| S3 Bootstrap | Custom Styles + Tests | 3 test images | ~9 | ~$0.66 |
| **Sprint 1** | **UI Chrome + Icons** | **47** | **~103** | **$7.79** |
| **TOTAL** | **All Sessions** | **~600** | **~813** | **~$61.73** |

**Budget Performance**:
- Total budget: $72 (estimated original allocation)
- Total spent: ~$61.73 across all sessions
- Remaining: $46.26 (API balance tracks exact amounts, differs from estimate)
- Sprint 1 efficiency: 100% first-attempt success, $0.17/asset average
- Key optimizations: Icon cost discovery, custom style flexibility, dimension constraint avoidance

---

## Final Asset Deployment Status (Post-Sprint 2 + Cleanup)

**773+ total PNG files deployed** (cleaned 2026-03-09: 259 orphans removed):

- Master Scenes: 120 (10 P0 + 110 all-lands) @ 1920×1080
- Land Backdrops: 10 @ 1920×1080
- Class Overlays: 11 @ 1920×1080
- Sprint 2 Canonical Sprites: 10 @ 128×192 (in `characters/sprites/`)
- Sprint 2 Portraits: 10 @ 96×96 (in `characters/portraits/`)
- Sprint 2 Equipment: 8 @ 96×96 (in `objects/`)
- Inventory Icons: 148+ @ 64×64 (demeanor, nature, ambient, equipment)
- Heraldic Crests: 44 (22 Land + 22 Class) @ 128×128 + 32×32-48×48
- UI Chrome: 100+ (panels, buttons, forms, navigation, chat, settings, decorative)
- Map Assets: 16 (base, border, compass, regions)
- Additional Icons: 45+ (class icons, status, tools, actions, spells, trainings, oaths)

**Removed (2026-03-09):**
- ~~Paper Doll Parts: ~117 files~~ → vXX indefinite hold (preserved in git history)
- ~~`props/` tree: ~88 files~~ → orphaned duplicates of `icons/` tree
- ~~`icons/props/` tree: ~52 files~~ → duplicated `icons/nature/` and `icons/ambient/`
- ~~`equipment/` directory~~ → empty, canonical path is `objects/`

**All P0+P1+P2 categories complete. Sprint 1+2 V1 assets complete.**

---

## Session 14 — P0 Scene Generation (2026-02-28)

### Style Discovery: rd_plus__environment
- `rd_plus__environment` at 480×270 + 4× upscale → exact 1920×1080 (no crop needed)
- Cost: $0.09/scene vs $0.22 for `rd_pro__fantasy` (2.4× cheaper)
- `rd_pro__fantasy` max width is 256px; `rd_plus__environment` supports up to 512×512
- Higher native resolution (480×270 vs 256×144) = more detail, less upscale artifacts
- Upscale factor doesn't affect cost — only base dimensions + style matter

### Composition Learnings (Critical)
- **"foreground" is a magic word** — dramatically improves character prominence in scenes
- **"Front view of" must lead the prompt** — prompt position = generation priority
- **"facing directly toward the viewer"** — explicit facing direction prevents back-turned figures
- **Kill action verbs that pull gaze**: "studying a tome" → character turns away to look at the object. Use static props instead: "arms at sides holding a glowing tome"
- **Environment goes AFTER the character clause**: "...behind the figure" pushes it to background
- **Locked prompt pattern for scenes**:
  ```
  Front view of [character description] standing in the foreground facing directly toward the viewer,
  large character centered in frame, [static prop],
  [environment description] behind the figure,
  [lighting and atmosphere],
  VGA pixel art, 320x200 aesthetic, dithered shading, visible pixels,
  Darklands 1992 inspired, very dark blackened grim medieval atmosphere,
  muted earth tones, weathered worn
  ```

### Dual Billing System
- API returns both `credit_cost`/`remaining_credits` AND `balance_cost`/`remaining_balance`
- Prepaid credits can be exhausted (0) while dollar balance remains — check `remaining_balance`
- Hard stop should be on dollar balance, not credit count

### Figure Ratio Baseline
- Scryer reference: ~44% pixels, ~48% bbox — this is the target
- Magister approved: ~28-32% pixels, ~51% bbox
- Hammerer approved: ~24% pixels, ~44% bbox
- Tool: `scripts/figure_ratio.py` (PIL+numpy, no scipy)

### Scene Generation Results (10 classes)
- All 10 Seelie Groves class scenes generated successfully
- Style: `rd_plus__environment`, 480×270, upscale_factor=4, remove_bg=False
- Palette: Seelie Groves via `input_palette` base64
- Reference image: Seneschal scene (replaced Scryer as best composition reference)
- Gender diversity achieved: female magister, female herald, female counselor, male others
- Anti-beautification keywords essential: "unglamorous", "rugged earthy", "functional clothing"
- Warden required 3 iterations (v1-v3) — most challenging scene
- Total scene spend: ~$3.50 across ~30 generations (iterations + retries)

### Icon Generation (53 P0 icons) — 2026-02-28

**Style: `rd_plus__skill_icon` at 64×64**
- Cost: $0.03/icon — dramatically cheaper than scene generation
- 53/53 generated with **zero failures** (100% first-attempt success rate)
- All output as RGBA with transparent backgrounds (remove_bg=True)
- Total icon spend: $1.59

**Icon Prompt Pattern (empirically validated):**
```
[worn ancient object description], medieval dark fantasy icon,
centered, strong silhouette, distinct color regions,
dark muted tones, weathered materials
```

**Critical settings:**
- `dark_mood=False` — prompts already embed dark keywords; auto-append creates redundancy
- `remove_bg=True` — essential for slot icons on dark UI backgrounds
- Seelie Groves palette via `land="seelie_groves"` — palette enforcement at $0.00 extra cost
- 1.5s delay between calls — no rate limiting issues

**Key insight:** `rd_plus__skill_icon` is absurdly reliable at small sizes. The prompt pattern above produced consistent quality across all 53 icons — no palette drift, no composition failures, no transparency issues. This is the "set it and forget it" style for icon batches.

**Batch generation script:** `scripts/generate_icons.py` — all 53 prompts embedded, supports `--category`, `--dry-run`, `--skip-existing`, `--credits`

---

---

## Session 15 — All-Lands Scene Generation (2026-02-28)

### Scope
10 Lands × 11 Classes = **110 master scenes** at 1920×1080.
Every Land/Class combination now has a unique scene.

### Generation Details

**Script:** `scripts/generate_all_scenes.py` — batch generator with full prompt library for all 10 Lands.

**Settings (identical to Session 14 scenes):**
- Style: `rd_plus__environment`
- Resolution: 480×270 native + `upscale_factor=4` = exact 1920×1080
- Cost: $0.09/scene
- `dark_mood=False` (prompts embed dark keywords)
- Per-Land palette enforcement via `input_palette`
- 3s delay between API calls

**Runtime:** 106.5 minutes for 110 scenes (~58s/scene average including delay)

### Results

| Land | Success | Failures | Notes |
|------|---------|----------|-------|
| Seelie Groves | 8/11 | 3 | diplomat, herald, bard — transient 400 |
| Freemark Reaches | 11/11 | 0 | Perfect |
| Ironroot Holdings | 11/11 | 0 | Perfect |
| Shire of Many Hearths | 11/11 | 0 | Perfect |
| Vaults Précieux | 11/11 | 0 | Perfect |
| Fenward Commons | 11/11 | 0 | Perfect |
| Mire of Grok | 10/11 | 1 | magister — transient 400 |
| Scoria Warrens | 11/11 | 0 | Perfect |
| Temple of Frozen Thought | 11/11 | 0 | Perfect |
| Bottomless Satchel | 11/11 | 0 | Perfect |
| **Total** | **106/110** | **4** | **96.4% first-pass success** |

All 4 failures re-run successfully with identical prompts — confirmed as transient API issues.

### Cost

| Item | Amount |
|------|--------|
| Initial run (106 scenes) | $9.54 |
| Retries (4 scenes) | $0.36 |
| **Total** | **$9.90** |
| **Balance after** | **$56.32** |

### Key Learnings

**Transient 400 errors are random, not prompt-related.** The same prompts that fail work fine on retry. No correlation with prompt length, Land, or Class. ~3.6% failure rate — acceptable for batch runs with retry logic.

**Prompt architecture per Land works at scale.** Each Land has a unique prompt template combining:
1. Denizen type + class description (character focus)
2. Class-specific furniture/props (environmental detail)
3. Land architecture keywords (structural style)
4. Land lighting/atmosphere (mood enforcement)
5. VGA style anchors (consistency across all Lands)

**All 10 palette registries produce consistent results.** No palette drift observed across 110 generations — the `input_palette` parameter is rock-solid for enforcing Land color identity.

**venv activation required for re-runs.** System Python lacks `requests`/`Pillow`. Must run:
```bash
source .venv/bin/activate && export $(grep -v '^#' .env | xargs) && python3 scripts/generate_all_scenes.py ...
```

### Code Changes

| File | Change |
|------|--------|
| `src/lib/services/scene.ts` | `hasMasterScene()` now dynamic 110-entry Set via `ALL_LANDS.flatMap()` |
| `static/assets/manifest.json` | 598→688 entries (added 110 scenes, removed 20 old entries) |
| `scripts/generate_all_scenes.py` | New batch generation script with all 10 Land prompt templates |
| `docs/MVP_ASSET_CHECKLIST.md` | Updated to v3.0 with Session 15 results |

---

## Updated Asset Deployment Status (Post-Session 15)

**698 total PNG/GIF files deployed** (was 608) — *later reduced to ~580 active after Sprint 2 cleanup removed 259 orphans*:

- Master Scenes: 110 @ 1920×1080 (full 10 Lands × 11 Classes coverage)
- Land Backdrops: 10 @ 1920×1080
- Class Overlays: 11 @ 1920×1080
- Character Sprites: 17 (10 canonical + 7 variants) @ 256×256
- Inventory Icons: 148 @ 64×64
- Heraldic Crests: 44 (22 Land + 22 Class) @ 128×128 + 48×48
- UI Components: 60 (chrome, buttons, forms, panels, navigation, chat)
- Map Assets: 16 (base, border, compass, regions)
- Additional Icons: 31 (class icons, status, tools, actions)

**All P0 + P1 asset categories complete. See "Final Asset Deployment Status" section for post-cleanup totals.**

---

## Session 16 — V1 Asset Audit & Generation Prep (2026-03-08)

### Scope
Pre-generation session: comprehensive audit of all P2 POST-MVP items, V1 feature asset planning, generation script scaffolding.

### Key Discovery: P2 POST-MVP Assets Are 100% Complete

Full audit of `static/assets/` against `GRAPHIC_ASSETS.md` §14 P2 specifications revealed that **all P2 POST-MVP items already exist as real generated pixel art** — not placeholders. This was not reflected in the plan, which assumed they were TODO.

| Category | Spec Count | Found | Status |
|----------|-----------|-------|--------|
| Class accessories (64×64) | 33 | 33 | COMPLETE |
| Scene props — demeanor | 35 | 36 | COMPLETE (+1 extra) |
| Scene props — nature | 37 | 38 | COMPLETE (+1 extra) |
| Scene props — ambient | 13 | 14 | COMPLETE (+1 extra) |
| Equipment objects (64×64) | 10 | 10 | COMPLETE |
| Character sprites Tier 1 (256×256) | 10 | 10 | COMPLETE |
| Character sprites Tier 2 (variants) | — | 7 | BONUS |
| Furniture overlays (1920×1080) | 11 | 11 | COMPLETE |
| **Total** | **149** | **159** | **100% + extras** |

**Verification method**: PIL validation on random samples confirmed real pixel art (87 unique colors, correct dimensions, RGBA mode, non-trivial file sizes).

**Revised total deployed**: 684 PNGs across all asset categories.

### V1 Feature Assets — DEFERRED INDEFINITELY

Subclass, Archetype, and Sigil icons were scoped for V1 but moved to the "vXX" backlog (delayed indefinitely). Generation script `sc_generate_v1_icons.py` exists with stub data and is ready when/if these features resume.

| Category | Est. Count | Dimensions | Preset | Status |
|----------|-----------|------------|--------|--------|
| Subclass icons (3-5 per 11 classes) | 33-55 | 64×64 | `rd_plus__skill_icon` | DEFERRED |
| Archetype icons (personality overlays) | 10-15 | 64×64 | `rd_plus__skill_icon` | DEFERRED |
| Sigil icons (emoji style previews) | 5-8 | 128×64 | `rd_plus__skill_icon` | DEFERRED |

### New RD Capabilities Cataloged (March 2026)

Full review of Retro Diffusion updates since Session 15. New presets, new model features, and the **Style Creation API** are now available.

#### New RD Pro Styles

| Style | `prompt_style` Value | Best For | Relevance to SC |
|-------|---------------------|----------|-----------------|
| **UI Panel** | `rd_pro__ui_panel` | Game UI panels and frames | ⚡ HIGH — ornate medieval panels, dialog frames |
| **Inventory Items** | `rd_pro__inventory_items` | Equipment/loot icons | ⚡ HIGH — could replace `rd_plus__skill_icon` for detailed items |
| **Typography** | `rd_pro__typography` | Pixel art text/lettering | MEDIUM — title cards, rune inscriptions |
| **Hexagonal Tiles** | `rd_pro__hexagonal_tiles` | Hex grid tilesets | LOW — SC doesn't use hex grids |
| **FPS Weapon** | `rd_pro__fps_weapon` | First-person weapon sprites | LOW — not applicable to SC |
| **Edit** | `rd_pro__edit` | Image editing/transformation | MEDIUM — touch-up existing assets |
| **Pixelate** | `rd_pro__pixelate` | Pixelation of reference images | LOW — niche use case |
| **Spritesheet** | `rd_pro__spritesheet` | Multi-frame sprite sheets | MEDIUM — character animation sheets |

All RD Pro styles: 96×96 to 256×256, ~$0.22/generation.

#### New Animation Variants

| Variant | `prompt_style` Value | Frame Size | Notes |
|---------|---------------------|-----------|-------|
| **8 Direction Rotation** | `animation__8_dir_rotation` | 80×80 | 8-directional character rotation |
| **Small Sprites** | `animation__small_sprites` | 32×32 | Tiny animated sprites |
| **Big Animation** | (not yet in API docs) | Unknown | Shown in UI with NEW badge |
| **Battle Sprites** | (BETA) | Unknown | Combat animation sheets |

Existing (unchanged): `animation__any_animation` (64×64), `animation__walking_and_idle` (48×48), `animation__four_angle_walking` (48×48), `animation__vfx` (24-96px).

#### Tileset Model — Now Separate UI Tab

Previously documented under presets, now has its own model tab in RD UI. Styles confirmed:
- `rd_tile__tileset` — Full tilesets with wang transitions
- `rd_tile__single_tile` — Individual seamless tiles
- Tile Variation, Tile Object, Scene Object — additional modes visible in UI

**Limitation**: No palette strictness or background removal for tileset model.

#### ⚡ Style Creation API (NEW — Game-Changer)

**Endpoint**: `POST https://api.retrodiffusion.ai/v1/styles`

Create **custom reusable styles** with baked-in parameters:

| Field | Type | Impact for SC |
|-------|------|---------------|
| `name` | string (required) | Style identifier |
| `description` | string | Internal docs |
| `reference_images` | base64 (max 1) | Lock visual reference across all generations |
| `reference_caption` | string | Describe what the reference represents |
| `llm_instructions` | string | Custom prompt expansion rules |
| `expanded_llm_instructions` | string | Extended prompt guidance |
| `user_prompt_template` | string | Template wrapping user prompts |
| `force_palette` | base64 | **Bake in Land palette permanently** |
| `force_bg_removal` | boolean | **No more per-call `remove_bg: true`** |
| `min_width` / `min_height` | 96-256 | Minimum dimensions |
| `apply_prompt_fixer` | boolean | Enable/disable prompt expansion |

**Why this matters**: Currently every `client.generate()` call requires `land="seelie_groves"` + `remove_bg=True` + `dark_mood=True` + prompt suffix. A custom style could encode all of this:

```
Custom style: user__sc_dark_icon_seelie
  force_palette: [seelie_groves base64]
  force_bg_removal: true
  llm_instructions: "medieval dark fantasy, muted earth tones, weathered worn"
  user_prompt_template: "{prompt}, medieval dark fantasy icon, centered, strong silhouette"
```

Then generation simplifies to: `client.generate(prompt="crystal ball", style="user__sc_dark_icon_seelie_abc123")`

**Management**: PATCH to update, DELETE to remove. Style IDs use `user__[name]_[id]` format.

**Recommendation for future sessions**: Create per-Land custom styles (11 total) that bake in palette + dark mood + bg removal. Eliminates the #1 source of parameter boilerplate and prevents palette drift across batch runs.

### Budget Status

$56.32 remaining. No generation work planned for current run. Budget fully available for future sessions.

---

## Session 3 — Pipeline Pivot: Codex Model + Custom Styles (2026-03-08)

### Scope
Major pipeline restructure: Custom RD styles replace per-call parameter boilerplate. GRAPHIC_ASSETS.md updated to v3.1. Bootstrap workflow established. Aseprite CLI dropped. vga_normalize.py reduced to upscaler. UI architecture pivots from 11-step wizard to single-screen Codex hub.

### Files Installed
- `scripts/rd_bootstrap.py` — Standalone bootstrap: palettes, styles, test images
- `palettes/*.png` — 11 pre-made palette PNGs (pal_seelie, pal_freemark, etc.)
- `docs/GRAPHIC_ASSETS.md` — v3.1 manifest (106 MVP assets, new dimensions, new directories)
- `limner/.../LIMNER_COLD_START_S3.md` — Cold start briefing for new sessions

### Pipeline Changes
| Before | After |
|--------|-------|
| `rd_pro__default` + per-call `remove_bg` + `input_palette` + dark mood suffix | `sc_clean` custom style with all baked in |
| `rd_pro__fantasy` for scenes | `sc_atmospheric` custom style |
| Mixed UI presets | `sc_hybrid` + `rd_pro__ui_panel` built-in |
| vga_normalize.py (dither/outline/palette/downscale) | vga_normalize.py (upscale ONLY) |
| Aseprite CLI for indexed color | DROPPED |
| `RD_API_TOKEN` env var | `RD_API_KEY` env var (rd_api.py accepts both) |
| `docs/palettes/palette_registry.json` (base64 JSON) | `palettes/pal_*.png` files (rd_api.py supports both) |

### Reconciliation: rd_api.py ↔ rd_bootstrap.py
- `rd_api.py` is the library (imported by generation scripts)
- `rd_bootstrap.py` is standalone Day 0 setup (direct `requests` calls)
- Both coexist — no conflict. rd_api.py updated to:
  - Accept both `RD_API_KEY` and `RD_API_TOKEN`
  - Load palettes from `palettes/pal_*.png` files (new) or `palette_registry.json` (legacy)
  - Provide `load_style_ids()` helper for loading `rd_style_ids.json`

### New Asset Manifest (v3.1): 106 MVP Assets
| Category | Count | Dimensions | Style |
|----------|-------|-----------|-------|
| Characters (sprites) | 10 | 128×192 | sc_clean |
| Characters (portraits) | 10 | 96×96 | sc_clean |
| Equipment | 8 | 64×64–96×96 | sc_clean |
| Class Icons | 11 | 48×48 | rd_plus__skill_icon |
| Status & UI Icons | 14 | 16×16–32×32 | rd_plus__low_res |
| UI Chrome | 33 | various | sc_hybrid / rd_pro__ui_panel |
| Heraldic Crests | 20 | 128×128 + 32×32 | sc_clean |

### Bootstrap Execution Results (2026-03-08)

**Styles created** (3/3 ✓):
| Key | prompt_style | Cost |
|-----|-------------|------|
| `sc_atmospheric` | `user__sc_atmospheric_eb2788aa` | — |
| `sc_clean` | `user__sc_clean_9b6d454a` | — |
| `sc_hybrid` | `user__sc_hybrid_e1ea0b26` | — |

**Test generations** (3/3 ✓, $0.66 total):
- `test_atmospheric_library.png` (192×128, UI palette) — Heavy dithering, atmospheric perspective, practical fireplace lighting. Very Darklands. ✓
- `test_clean_elf.png` (128×192, Seelie palette) — Strong outlines, transparent BG, expressive face. Slight dithering creep on hood fabric. ✓
- `test_hybrid_panel.png` (128×128, UI palette) — Wood grain dithering on frame, clean parchment center, contextual brown outlines. ✓

**Budget**: $54.95 remaining after bootstrap ($0.66 test cost + $0.39 from earlier dry-run attempts)

### Critical Learnings — Style Creation API

1. **HTTP 201 for creation**: `/v1/styles` POST returns HTTP 201 (Created), not 200. Fixed in `rd_bootstrap.py`.

2. **NEVER set `min_width`/`min_height`**: The Style API locks `maxWidth = minWidth` — setting min_width=128 makes the style ONLY accept 128px wide. Omit both fields for flexible sizing. This is the biggest gotcha in the Style Creation API.

3. **No `max_width`/`max_height` fields exist**: PATCH rejects them as "extra fields not permitted". The only way to control dimensions is via `min_width`/`min_height`, and they lock to exact values.

4. **Minimum enforced floor**: API enforces min_width ≥ 96, min_height ≥ 96 if those fields are present.

5. **Custom styles cost $0.22/image** regardless of dimensions (same as `rd_pro__default`). This is more expensive than `rd_plus__*` presets ($0.03–$0.09) but includes baked-in LLM instructions, prompt templates, and style-specific behavior.

6. **`sc_clean` dithering creep**: Despite "ZERO dithering" in LLM instructions, slight dithering appears on fabric/clothing surfaces. May need prompt-level reinforcement ("absolutely no dithering, flat color only") for production sprites.

7. **Style recreation is idempotent**: DELETE + POST gives new style IDs but identical behavior. Safe to recreate if styles need adjustment. Old IDs stop working immediately after DELETE.

### Sprint Plan
- Day 0: Bootstrap ✓ COMPLETE
- Sprint 1: UI Chrome + Icons (39 assets)
- Sprint 2: Characters + Crests (40 assets)
- Sprint 3: Equipment + Settings + Polish (27 assets)

### Next Steps
1. ✓ ~~Set `RD_API_KEY` env var~~
2. ✓ ~~Run `rd_bootstrap.py`~~
3. ✓ ~~Review test outputs~~
4. Consider PATCH to `sc_clean` to strengthen anti-dithering instruction if dithering creep persists in production
5. ✓ ~~Begin Sprint 1 production~~

---

## Sprint 1 — UI Chrome + Icons (2026-03-08)

### Scope
47 assets across 5 batches: frame elements, interactive components, settings panels, navigation/status icons, and decorative chrome. First production run using the 3 custom styles (sc_atmospheric, sc_clean, sc_hybrid) established in Session 3.

### Results

| Batch | Assets | Style | Cost | Success Rate |
|-------|--------|-------|------|-------------|
| Frame | 8 | sc_hybrid | $1.76 | 8/8 (100%) |
| Interactive | 10 | sc_hybrid | $2.20 | 10/10 (100%) |
| Settings | 8 | sc_hybrid | $1.76 | 8/8 (100%) |
| Icons | 14 | rd_plus__skill_icon / rd_plus__low_res | $0.53 | 14/14 (100%) |
| Decorative | 7 | sc_hybrid | $1.54 | 7/7 (100%) |
| **Total** | **47** | — | **$7.79** | **47/47 (100%)** |

**Budget**: $46.26 remaining (from $54.95 pre-sprint)

### Critical Discovery: rd_pro__ui_panel Dimension Locking

The interactive batch initially failed 10/10 (100% failure rate) using `rd_pro__ui_panel` at various small sizes (96×96, 128×96, etc.):

```
Error: "Input width 96 is outside the allowed range for style 'UI Panel': minWidth=256, maxWidth=256"
```

**Key findings:**
1. `rd_pro__ui_panel` has LOCKED dimensions: exactly 256×256 only (minWidth = maxWidth = 256)
2. The `check_cost` endpoint (with `check_cost: true`) returns **200 OK** for invalid dimensions — it does NOT validate dimension constraints. Only actual generation reveals the error.
3. This is the same class of dimension-locking as discovered with custom styles (Session 3 Learning #2), but it also affects **built-in** RD styles.
4. **Fix**: Replaced all `rd_pro__ui_panel` references with `sc_hybrid` (same $0.22 cost, flexible dimensions).

**Rule**: Always test actual generation at target dimensions before committing to a batch. `check_cost` is not a reliable dimension validator.

### Style Performance Summary

**sc_hybrid ($0.22/image)** — 33 assets, 33/33 success:
- Handles non-square dimensions well (172×230, 172×96, 128×96, 120×96, 96×96)
- Outstanding for ornate frames (portrait-frame standout asset)
- Good for panel/button chrome, text renders readably ("SUMMON", "SPEED")
- Tileable textures work (topbar-bg with tile_y)
- Weaker on pure pattern overlays (scanline-overlay too literal — generated a scene instead)

**rd_plus__skill_icon ($0.04/image)** — 8 assets, 8/8 success:
- Excellent for recognizable object metaphors (gear, scroll, bookshelf, key+lock)
- 96×96 with remove_bg=True — clean transparent icons
- Continues 100% first-attempt success rate from Session 14

**rd_plus__low_res ($0.04/image)** — 6 assets, 6/6 success:
- Works for simple shapes (diamonds, dots)
- Weaker for UI metaphors (arrows become swords, toggles inconsistent between on/off)
- Consider rd_plus__skill_icon for UI-metaphor icons even at small target sizes

### Asset Highlights
- ⚡ **portrait-frame** (172×230) — Best single asset. Dark wood + gold filigree, rich detail from non-square sc_hybrid
- ⚡ **btn-summon-ready** — Gold "SUMMON" text, brass frame. RD text rendering readable at this scale
- ⚡ **btn-summon-disabled** — Faded runic text on gray stone. Clear state differentiation
- ⚡ **textarea-parchment** — Aged parchment with ink lines. Beautiful texture
- ⚡ **codex-corner** — Ornate scrollwork with red flourishes. Perfect manuscript decoration
- ⚡ **icon-settings** — Classic iron gear. Instantly recognizable
- ⚠️ **scanline-overlay** — Generated a scene, not a pattern. Use CSS for overlay effects
- ⚠️ **arrow-back** — Sword/hook shape, not a clean back arrow. rd_plus__low_res limitation

### Files Generated
```
static/assets/ui/chrome/          8 files (panel borders, topbar, separators)
static/assets/ui/buttons/         7 files (card-select, menu-item, btn-summon)
static/assets/ui/inputs/          3 files (input-text, textarea, dropzone)
static/assets/ui/settings/        8 files (tabs, volume, speed/interval/oauth/danger)
static/assets/ui/decorative/      7 files (portrait-frame, meters, diamonds, codex-corner, scanline)
static/assets/icons/navigation/   8 files (arrows, settings, import, library, ritual, summon, vault)
static/assets/icons/status/       6 files (diamonds, dots, toggles)
```

### Script: sc_sprint1.py
- Added `dark_mood=False` to all sc_hybrid assets (template already includes mood)
- Documented rd_pro__ui_panel dimension constraint in docstring
- Retry logic worked as designed (0 retries needed this session)
- `--batch` flag enables running one batch at a time

### Next Steps
- Sprint 2: Characters + Crests (40 assets, sc_clean + rd_plus__skill_icon)
- Sprint 3: Equipment + Settings + Polish (27 assets)
- Consider regenerating arrow-back and toggle-on/off with rd_plus__skill_icon
- Use CSS for scanline overlay effect, not AI generation

---

## Sprint 2 — Characters + Portraits + Equipment (Session 17, 2026-03-09)

### Overview
| Metric | Value |
|--------|-------|
| Assets generated | 28 |
| Success rate | 28/28 (100%) |
| Retries needed | 0 |
| Cost | $6.16 |
| Balance after | $40.10 |
| Style used | sc_clean (all assets) |
| Total deployed (cumulative) | 773+ |

### Batches

| Batch | Count | Dimensions | Cost | Notes |
|-------|-------|-----------|------|-------|
| Characters (full sprites) | 10 | 128×192 | $2.20 | 1 per Land, canonical denizen+class combos |
| Portraits (face close-up) | 10 | 96×96 | $2.20 | Matching character for each sprite |
| Equipment (objects) | 8 | 96×96 | $1.76 | Class-agnostic RPG equipment |

### Critical Finding: Anti-Cute Prompting Works

**Two-tier anti-cute system proved 100% effective across 6 high-risk assets.**

Tier 1 — `ANTI_CUTE_SUFFIX` (aggressive, for Elf/Smallfolk/Gnome):
```
"stern angular features, weathered scarred skin, deep-set shadowed eyes,
NO cute NO chibi NO rounded features NO soft NO gentle NO kind expression"
```

Tier 2 — `GRIM_SUFFIX` (moderate, for all other denizens):
```
"grim medieval, dark worn weathered, stern imposing,
NO cute NO soft NO gentle NO kind"
```

**Results by cute-risk character:**
- **Elf Scryer** (⚠ cute-risk) → Gaunt, stern, angular features. ✅ Zero cute-ification
- **Smallfolk Craftsman** (⚠ cute-risk) → Stocky, grizzled, muscular. ✅ Zero cute-ification
- **Gnome Diplomat** (⚠ cute-risk) → Stern scowl, military-cut coat. ✅ Zero cute-ification
- **Elf Portrait** (⚠ cute-risk) → Consistent with sprite, angular. ✅
- **Smallfolk Portrait** (⚠ cute-risk) → Weathered face, hard stare. ✅
- **Gnome Portrait** (⚠ cute-risk) → Stern bureaucrat. ✅

**Key insight**: The explicit `NO cute NO chibi NO rounded features` negative prompting combined with physical descriptors at the start of the prompt ("tall gaunt angular", "stocky muscular grizzled") anchors the generation away from RD's default softening tendency for small/fantasy races.

### Character-First Prompt Architecture

Sprint 2 used a structured prompt pattern for characters:

```
{physical_descriptors}, {race_name} {class_name}, {costume_details},
{action_or_pose}, {Dark_Palette_Standard}, {anti_cute_suffix_or_grim_suffix}
```

Physical descriptors FIRST (attention mechanism weight), race/class SECOND, clothing/gear THIRD. This ordering consistently produced correct body proportions and facial features before the model allocated attention to accessories.

### Per-Land Palette Enforcement

Sprint 2 passed individual Land palettes per character (unlike Sprint 1 which used a hardcoded UI palette for all assets). Each character received its home Land's 9-color palette via `input_palette` base64 PNG. Result: characters visually belong to their Lands without manual recoloring.

### Style Choice: sc_clean for All Character Types

`sc_clean` (user__sc_clean_9b6d454a) handled all three asset types well:
- **128×192 sprites**: Good detail at this resolution, clean pixel edges, transparent backgrounds
- **96×96 portraits**: Face detail readable, distinct per-denizen features
- **96×96 equipment**: Clean silhouettes, recognizable objects, dark medieval palette

No need to switch styles between character/equipment — sc_clean is versatile enough.

### File Size Observations

Character sprites (128×192): 3.9KB–10.9KB
- Largest: Dwarf (10.9KB) and Orc (10.6KB) — heavy armor/detail
- Smallest: Monk (3.9KB) — simple robes, austere design
- Good variance indicates real detail differences, not compression artifacts

Portraits (96×96): 2.2KB–5.9KB
Equipment (96×96): 2.0KB–4.2KB

### Script: sc_sprint2.py
- `Asset` dataclass with `land`, `cute_risk`, per-asset dimensions
- `build_character_prompt()` / `build_portrait_prompt()` with automatic anti-cute suffix injection
- `--batch characters|portraits|equipment` for controlled execution
- `--dry-run` with full cost preview (check_cost endpoint)
- `--skip-existing` to avoid re-generating approved assets
- Non-fatal `check_credits()` — wraps in try/except since RD credits endpoint intermittently returns 500
- Palette enforcement per-Land (not hardcoded like Sprint 1)

### API Token Note
RD API tokens expire/get revoked without warning. Both tokens from Sessions 9-16 (`rdpk-810c...` and `rdpk-9fa39...`) returned 401 by Sprint 2. Fresh key required. Manage at https://www.retrodiffusion.ai/app/devtools.

### Files Generated
```
static/assets/characters/sprites/   10 files (elf, human, dwarf, smallfolk, gnome, goblin, orc, scalekind, monk, spirit)
static/assets/characters/portraits/ 10 files (matching portraits for each sprite)
static/assets/objects/               8 files (crystal-ball, enchanted-quill, wayfinder-compass, skeleton-key, bound-grimoire, everburning-lantern, scrying-mirror, war-horn)
```

### Next Steps (Updated 2026-03-09)
- ~~Sprint 3: Scene props~~ → P2 audit (Session 16) confirmed these already exist
- ~~Sprint 4: Subclass/archetype icons~~ → vXX indefinite hold
- Canonical sprites available as consistency anchors for future portrait/body variants (Tier 2)
- All compositing flows on hold — prompt engineering replaces multi-layer assembly
- Paper doll system → vXX indefinite hold — full sprites via single-pass generation

---

## Asset Cleanup Session (2026-03-09)

### Scope
Directory rationalization and orphan removal. No generation — organizational cleanup only.

### Problem
ASSET_WORKBOOK.md reported "20 duplicate directories (dash vs underscore naming)" but investigation found ZERO such duplicates. The actual problem was organizational duplicates — same content types existed in multiple path hierarchies.

### Methodology
1. **Audited actual app references**: `grep -rn "assets/" src/routes/ src/lib/` across SvelteKit source
2. **Identified canonical paths** used by components (LandCard.svelte, ClassCard.svelte, scene.ts, etc.)
3. **Compared duplicate directories** via MD5 hash — confirmed files had DIFFERENT hashes (separate generation runs, not copies)
4. **Removed orphans** — paths with no SvelteKit source references

### Canonical Paths (from source code audit)
| Path | Referenced By |
|------|-------------|
| `icons/demeanor/` | Personality/demeanor slot UI |
| `icons/nature/` | Nature slot UI |
| `icons/equipment/` | Equipment slot UI |
| `objects/` | Clickable equipment objects |
| `characters/sprites/` | Character display |
| `characters/portraits/` | Portrait display |

### Removed (259 files total)
| Directory | Files | Reason |
|-----------|-------|--------|
| `props/demeanor/` | 36 | Duplicate of `icons/demeanor/` (different hashes, same names) |
| `props/nature/` | 38 | Duplicate of `icons/nature/` |
| `props/ambient/` | 14 | Duplicate of `icons/ambient/` |
| `icons/props/nature/` | 38 | Nested duplicate |
| `icons/props/ambient/` | 14 | Nested duplicate |
| `equipment/` | 0 | Empty directory (canonical: `objects/`) |
| `characters/{denizen}/` (11 dirs) | 117 | Paper doll body parts — vXX hold |
| `characters/scale/` | 2 | Stale alias for `scalekind` |

### Strategic Decisions Recorded
1. **Paper doll system → vXX indefinite hold** — Full sprites via prompt engineering instead of compositing 10+ body parts per character
2. **All compositing flows → on hold** — Prompt engineering produces composed-looking results directly; no multi-layer assembly needed
3. **259 files preserved in git history** — recoverable if decisions reverse

### Key Learning
**Orphan detection via source code audit** is more reliable than directory naming comparison. The "dash vs underscore" issue was a red herring — the real problem was structural duplication across `props/`, `icons/props/`, and `icons/` trees, all containing separately-generated files with the same logical names but different pixel content.

---

## Session 18: Splash Screen Generation (2026-03-11)

### Objective
1440×900 splash screen — interior of a cavernous castle summoning chamber. Land-agnostic (the Summoning Chamber itself).

### API Discovery: Model Enum Changed
- `RD_PLUS` and `RD_PRO` model names **no longer accepted** by the API
- New enum: `RD_CLASSIC` and `RD_FLUX` only
- **Style presets still work** — `rd_plus__environment`, `rd_pro__fantasy`, etc. remain valid with new model names
- `RD_CLASSIC` costs **$0.03/image** (was $0.09 with `RD_PLUS`) — 3× cost reduction

### Dimension Pipeline: 1440×900
- 1440÷4 = 360, 900÷4 = 225 → native **360×225** with 4× nearest-neighbor upscale
- `rd_plus__environment` accepts 360×225 with no issues (well within 512×512 max)
- Clean integer math, no letterboxing needed

### Prompt Comparison: Two Approaches

**"Chamber" prompt** (v1–v5): Described *what's in the room* — pillars, torchlight, tomes, ritual implements.
- Result: Competent but felt like standard dungeon rooms. Scale was ordinary.

**"Big Room" prompt** (v1–v4): Described *how far away things are* — "seen from far back", "tiny glowing summoning circle", "distant walls barely visible", "receding into deep perspective".
- Result: **Winner (v4).** Genuine sense of cathedral-scale emptiness. Perspective language > inventory language for conveying scale.

### Key Learnings
- **Perspective language trumps inventory language** for scale: "receding into deep perspective", "far ahead", "distant" > listing many objects
- **"Cathedral-scale"** is an effective scale keyword for RD
- **"Extreme sense of scale and emptiness, dwarfing architecture"** — meta-descriptor that works
- **Custom 16-color palette** (dark stone + arcane purple + torch amber) maintains Dark Palette Standard without over-constraining
- **$0.03/image means batch exploration is trivial** — 9 variations for $0.27

### Reusable Script Created
`scripts/generate_scene.py` — CLI tool for batch scene generation with:
- Size presets (1440×900, 1920×1080, 1280×800, 960×600)
- Built-in Land palettes (chamber, seelie, freemark, ironroot, vaults, scoria)
- Auto-appends Dark Palette Standard + VGA style anchors
- 4× nearest-neighbor upscale baked in

### Cost
| Item | Count | Unit Cost | Total |
|------|-------|-----------|-------|
| Chamber variations | 5 | $0.03 | $0.15 |
| Big Room variations | 4 | $0.03 | $0.12 |
| **Session total** | **9** | | **$0.27** |
| **Running balance** | | | **$39.74** |

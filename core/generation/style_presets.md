# Style Preset Selection — Stream-Based Mapping

> Framework for selecting Retro Diffusion API style presets based on rendering stream and asset type

## Overview

Retro Diffusion provides 20+ style presets optimized for different pixel art aesthetics. This document maps those presets to a three-stream rendering model that categorizes assets by their visual characteristics and quality requirements.

**Stream Model**:
- **Stream A (Atmospheric)** — Backgrounds, environments, scenes with depth
- **Stream B (Clean)** — Characters, sprites, props with clear silhouettes
- **Stream C (Hybrid)** — Furniture, UI, large props requiring both texture and clarity

This framework is project-agnostic — adapt the stream assignments to your specific visual requirements.

---

## Stream A: Atmospheric (Backgrounds, Environments)

**Visual Characteristics**:
- Depth cues via atmospheric perspective
- Material textures (stone grain, wood knots, fabric weave)
- Soft transitions between regions (via dithering, not gradients)
- Light sources with visible falloff
- Multi-plane composition (foreground/midground/background)

**Quality Priorities**:
1. Atmospheric depth over silhouette clarity
2. Material authenticity over graphic simplicity
3. Environmental mood over individual object definition

### rd_pro__fantasy

**Best For**:
- Land/region backdrops (1920×1080 or tiled)
- Complex environment scenes
- Multi-element compositions (character + furniture + environment)
- Locations requiring detailed textures

**Quality Characteristics**:
- Detailed material rendering (weathered stone, carved wood, woven fabric)
- Soft atmospheric transitions via subtle dithering
- Rich color palette usage (uses full palette range if provided)
- Light source modeling (candles, torches, ambient glow)

**Cost**: RD_PRO tier (~$0.22 per generation)

**Parameters to Pair With**:
- `input_palette` (REQUIRED) — Without this, defaults to bright saturated colors
- `reference_images` (optional) — For compositional guidance
- Dark palette keywords in prompt: "very dark", "dim lighting", "weathered worn"

**Common Issues**:
- **Too bright by default** — Always pair with dark `input_palette` + dark prompt keywords
- **Ignores simple subjects** — This preset wants complexity; use simpler presets for isolated objects

**Example Use Cases** (from Summoning Chamber):
- Land backdrops (Seelie Groves organic wood interior, Ironroot Holdings stone halls)
- Master scenes (character + furniture + environment composited)
- Environmental props (large furniture pieces with material texture)

---

### rd_pro__horror

**Best For**:
- Dark/grim environments (dungeons, crypts, swamps)
- Gothic/macabre locations
- High-contrast dramatic lighting scenes
- Environments requiring harsh shadows

**Quality Characteristics**:
- Harsh edge definition (stronger outlines than rd_pro__fantasy)
- High contrast (deep blacks, limited midtones)
- Gritty textures (rough stone, splintered wood, rust)
- Dramatic lighting (single strong source, deep shadows)

**Cost**: RD_PRO tier (~$0.22 per generation)

**Parameters to Pair With**:
- `input_palette` with darkest colors
- Harsh lighting keywords: "harsh shadows", "single torch", "blackened"

**When to Use vs. rd_pro__fantasy**:
- Use **rd_pro__horror** when you need high contrast and harsh edges
- Use **rd_pro__fantasy** when you need softer atmospheric depth

**Example Use Cases**:
- Mire of Grok (toxic swamp with brutal aesthetic)
- Scoria Warrens (harsh desert ruins)
- Any "dark fantasy" location with oppressive mood

---

### rd_plus__environment

**Best For**:
- Mid-tier environment generation (lower cost than RD_PRO)
- Isometric/one-point perspective scenes
- Tilesets and modular environment pieces
- Background layers for parallax scrolling

**Quality Characteristics**:
- Strong geometric shapes
- Clear outline definition
- Simplified material rendering (less texture detail than rd_pro__fantasy)
- Consistent perspective (one-point or isometric)

**Cost**: RD_PLUS tier (~$0.025–$0.05 per generation)

**When to Use vs. rd_pro__fantasy**:
- Use **rd_plus__environment** for budget-conscious iterations or simpler scenes
- Use **rd_pro__fantasy** for hero backdrops requiring maximum detail

**Example Use Cases**:
- Modular environment tiles (platforms, walls, floors)
- Background layers (distant buildings, sky, terrain)
- Isometric room layouts

---

### rd_tile__single_tile

**Best For**:
- Seamless floor textures (16–64px tiles)
- Seamless wall textures
- Repeating patterns (fabric, stone, metal)

**Quality Characteristics**:
- Mathematically seamless edges (tiles infinitely without visible seams)
- Uniform density (no directional flow that would reveal tiling)
- Micro-detail appropriate to tile size

**Cost**: RD_TILE tier (~$0.10 per tileset)

**Size Constraints**: 16–64px square tiles only

**Example Use Cases**:
- Stone floor tiles for dungeons
- Wood plank flooring
- Fabric patterns for banners/curtains
- Metal grating textures

---

### rd_tile__tileset

**Best For**:
- Complete tileset generation with edge transitions
- Wang tile combinations (auto-matching corners/edges)
- Full environment kits (walls, floors, corners, transitions)

**Quality Characteristics**:
- Full tileset with all edge combinations
- Automatic corner/edge matching
- Seamless transitions between tile variants

**Cost**: RD_TILE tier (~$0.10 per tileset)

**Output**: Complete tileset PNG with all tile variations

**Example Use Cases**:
- Dungeon tileset (walls, floors, corners, intersections)
- Terrain tileset (grass, dirt, stone with transitions)
- Interior floor tileset (wood planks with directional variants)

---

## Stream B: Clean (Characters, Sprites, Props)

**Visual Characteristics**:
- Clear silhouettes (instantly recognizable shape)
- Hard pixel edges (no anti-aliasing)
- Flat or minimal shading (1–3 shades per color region)
- Strong outlines (optional but common)
- Transparent backgrounds (clean alpha channel)

**Quality Priorities**:
1. Silhouette clarity over material texture
2. Readability at small sizes over atmospheric detail
3. Clean color regions over dithered transitions

### rd_pro__default

**Best For**:
- Character sprites (full-body, 256×256 or larger)
- Large equipment objects (swords, shields, complex props)
- Detailed creatures/monsters
- Any subject requiring maximum detail with clean execution

**Quality Characteristics**:
- Clean pixel art aesthetic (Chrono Trigger style)
- Hard edges, no anti-aliasing
- Flat shading or cel-shaded regions
- Strong color separation (distinct regions)

**Cost**: RD_PRO tier (~$0.22 per generation)

**Parameters to Pair With**:
- `remove_bg: true` (REQUIRED for transparent background)
- `reference_images` (up to 9) — Lock character appearance across variants
- `seed` — Reproduce approved poses/compositions

**Character Generation Workflow**:
1. Generate canonical character with rd_pro__default
2. Use approved sprite as reference image for class variants
3. Maintains facial features, proportions, color palette across generations

**Example Use Cases**:
- Character sprites (Elf Scryer, Dwarf Hammerer, Orc Warden)
- Large props (crystal ball on stand, ornate chest, weapon rack)
- Creatures (familiars, pets, enemies)

---

### rd_pro__simple

**Best For**:
- Small props (64–128px)
- Clean icons requiring minimal shading
- Simple equipment objects
- UI elements with subject focus (not pure interface)

**Quality Characteristics**:
- Minimal shading (1–2 shades per color)
- Very strong outlines
- Simplified forms (geometric clarity)
- High contrast

**Cost**: RD_PRO tier (~$0.22 per generation)

**When to Use vs. rd_pro__default**:
- Use **rd_pro__simple** when subject is small or needs extreme clarity
- Use **rd_pro__default** when subject is large enough to support detail

**Example Use Cases**:
- Small props (quill, candle, hourglass)
- Simple equipment (dagger, potion bottle, key)
- Clean icon subjects (not full UI icons — use rd_plus__skill_icon for those)

---

### rd_plus__classic

**Best For**:
- Heraldic crests (32–192px)
- Emblems and badges
- Coat of arms designs
- Shield/banner decorations

**Quality Characteristics**:
- Strong black outlines
- Simple geometric shading
- Limited palette usage (3–5 colors typical)
- Symmetrical compositions (when appropriate)

**Cost**: RD_PLUS tier (~$0.025–$0.05 per generation)

**Proven Workflow** (from Session 4-5):
1. Generate 1024×1024 crest
2. Crop to subject area (remove any decorative frame)
3. Square on dark background
4. Downscale to target size (128×128 or 48×48)

**Example Use Cases**:
- Class crests (Scryer, Magister, Hammerer)
- Land heraldic symbols
- Guild emblems
- Faction badges

---

### rd_plus__skill_icon

**Best For**:
- Game UI skill icons (64×64 typical)
- Status effect icons
- Inventory item icons
- Action button icons

**Quality Characteristics**:
- Purpose-built for icon clarity at small sizes
- Strong silhouettes
- High contrast
- Clean transparent backgrounds

**Cost**: RD_PLUS tier (~$0.025–$0.05 per generation)

**Cost Discovery** (Session 11):
- **Actual**: 2 credits per icon (~$0.15)
- **Estimated**: 4–6 credits (~$0.30–$0.45)
- **Savings**: 50–70% cheaper than estimated

**Parameters to Pair With**:
- `remove_bg: true` (REQUIRED)
- `width: 64, height: 64` (or target icon size)

**Example Use Cases**:
- Demeanor props (candle, seal, decree, inkwell, mug)
- Nature props (chart, diagram, palette, blanket)
- Status icons (thinking, researching, idle, error)

---

### rd_plus__topdown_item

**Best For**:
- Equipment objects viewed from above
- Inventory items (top-down perspective)
- Loot/pickup objects
- Tabletop-style props

**Quality Characteristics**:
- Top-down orthographic perspective
- Functional object design (recognizable purpose)
- Clean item separation (if multiple objects)
- Strong shadows/outlines for depth

**Cost**: RD_PLUS tier (~$0.025–$0.05 per generation)

**When to Use vs. rd_plus__skill_icon**:
- Use **rd_plus__topdown_item** when subject needs perspective (3D object viewed from above)
- Use **rd_plus__skill_icon** when subject is flat/iconic (2D symbol or front-facing)

**Example Use Cases**:
- Equipment objects (crystal ball, tome, gears, horn)
- Loot items (gold pile, gem, scroll)
- Tabletop props (dice, cards, tokens)

---

## Stream C: Hybrid (Furniture, UI, Large Props)

**Visual Characteristics**:
- Material texture (like Stream A) + clear object definition (like Stream B)
- Functional detail (screws, hinges, carved decorations visible)
- Multiple elements composed but individually distinct
- Balance between atmospheric integration and graphic clarity

**Quality Priorities**:
1. Functional detail over atmospheric depth
2. Material authenticity balanced with silhouette clarity
3. Individual object definition within composition

### rd_pro__fantasy (Hybrid Use)

**Best For**:
- Furniture arrangements (desks, shelves, workbenches)
- Large composite props (multiple items grouped)
- Environment details requiring material texture
- Props that integrate into atmospheric backgrounds

**Quality Characteristics** (Hybrid Context):
- Material texture rendering (carved wood, hammered metal, woven fabric)
- Individual object clarity (each furniture piece distinct)
- Functional details visible (hinges, handles, joints, decorations)
- Softer edges than Stream B but harder than Stream A pure backgrounds

**Cost**: RD_PRO tier (~$0.22 per generation)

**Hybrid Prompt Pattern**:
```
collection of [furniture type] items, [specific items],
isolated objects, material texture detail,
functional construction visible, medieval dark fantasy
```

**Example Use Cases**:
- Class furniture overlays (Scryer's scrying mirror + candles + books)
- Workshop arrangements (Hammerer's anvil + tools + forge elements)
- Study compositions (Magister's desk + bookshelves + scrolls)

---

### rd_fast__ui

**Best For**:
- UI panels and frames
- Button backgrounds
- Menu chrome elements
- Dialog boxes

**Quality Characteristics**:
- Purpose-built for UI generation
- Clean geometric shapes
- 9-slice friendly (tileable borders)
- Fast iteration (lowest cost tier)

**Cost**: RD_FAST tier (~$0.015–$0.025 per generation)

**Best Practice**: Generate at higher resolution, test 9-slice tiling, iterate quickly

**Example Use Cases**:
- Panel frames (card borders, dialog boxes)
- Button states (normal, hover, pressed, disabled)
- Menu backgrounds
- Dividers and separators

---

### rd_plus__ui_element

**Best For**:
- Detailed UI chrome (ornate frames, decorated panels)
- Complex button designs (multi-state with decorations)
- Specialized UI widgets (sliders, toggles, progress bars)
- UI elements requiring more detail than rd_fast__ui provides

**Quality Characteristics**:
- More detail than rd_fast__ui
- Ornate decorations (scrollwork, rivets, engravings)
- Higher fidelity for hero UI elements

**Cost**: RD_PLUS tier (~$0.025–$0.05 per generation)

**When to Use vs. rd_fast__ui**:
- Use **rd_plus__ui_element** for hero UI (main menus, important dialogs)
- Use **rd_fast__ui** for utilitarian UI (inventory grids, chat panels)

**Example Use Cases**:
- Ornate menu frames (main menu, settings panel)
- Decorated buttons (primary actions, hero buttons)
- Custom sliders/toggles with thematic styling

---

## New RD Pro Styles (Added March 2026)

### rd_pro__ui_panel

**Best For**:
- Game UI panels and frames with ornate detail
- Dialog boxes with medieval/fantasy styling
- Menu backgrounds with decorative borders
- Complex UI chrome requiring RD_PRO quality

**Quality Characteristics**:
- Higher detail than `rd_fast__ui` or `rd_plus__ui_element`
- Ornate decorations (scrollwork, rivets, engravings)
- Material textures on frames (carved wood, hammered metal)
- RD_PRO quality at RD_PRO cost

**Cost**: RD_PRO tier (~$0.22 per generation)

**Size Range**: 96×96 to 256×256

**When to Use vs. Existing UI Presets**:
- Use **rd_pro__ui_panel** for hero UI elements requiring maximum detail
- Use **rd_plus__ui_element** for mid-tier UI with good detail at lower cost
- Use **rd_fast__ui** for utilitarian UI and rapid iteration

**Example Use Cases**:
- Main menu frames with ornate medieval styling
- Character sheet panels with detailed borders
- Modal dialogs with decorative chrome
- Settings panels with themed ornamentation

---

### rd_pro__inventory_items

**Best For**:
- Detailed inventory/equipment icons at RD_PRO quality
- Loot and pickup object sprites
- Detailed item art (weapons, armor, potions, scrolls)
- Items requiring more material texture than `rd_plus__skill_icon` provides

**Quality Characteristics**:
- More material detail than `rd_plus__skill_icon` (leather grain, metal polish, gem facets)
- Purpose-built for game inventory display
- Clean item separation with strong silhouettes
- RD_PRO quality rendering

**Cost**: RD_PRO tier (~$0.22 per generation)

**Size Range**: 96×96 to 256×256

**When to Use vs. rd_plus__skill_icon**:
- Use **rd_pro__inventory_items** when items need material texture detail (ornate weapons, detailed armor)
- Use **rd_plus__skill_icon** for abstract/iconic items at budget pricing ($0.025 vs $0.22)
- **Rule of thumb**: If the item is the "hero" of a tooltip or detail view, use rd_pro. For grid-view icons, rd_plus is sufficient.

**Example Use Cases**:
- Detailed weapon art for inspection views
- Armor pieces with visible material texture
- Potions/scrolls with decorative detail
- Treasure items (gems, artifacts, relics)

---

### rd_pro__typography

**Best For**:
- Pixel art text and lettering
- Title cards and headers
- Rune inscriptions and glyphs
- Styled text overlays

**Quality Characteristics**:
- Text-optimized pixel rendering
- Clean letterform edges
- Stylized font generation (not system fonts)

**Cost**: RD_PRO tier (~$0.22 per generation)

**Size Range**: 96×96 to 256×256

**Example Use Cases**:
- Game title cards
- Section headers with themed lettering
- Rune/glyph text for fantasy interfaces
- Stylized labels

---

### rd_pro__spritesheet

**Best For**:
- Multi-frame sprite sheets (character poses, item variants)
- Organized sprite grids
- Asset sheets with multiple views

**Quality Characteristics**:
- Grid-organized output
- Consistent sizing across frames
- Clean frame separation

**Cost**: RD_PRO tier (~$0.22 per generation)

**Size Range**: 96×96 to 256×256

**Example Use Cases**:
- Character pose sheets (idle, action, damaged)
- Item variant grids (weapon types, potion colors)
- Multi-angle object views

---

### rd_pro__edit

**Best For**:
- Editing/transforming existing pixel art images
- Touch-up and refinement of generated assets
- Style transfer onto existing images

**Quality Characteristics**:
- Takes input image + text prompt
- Modifies existing art rather than generating from scratch
- Preserves original composition while applying changes

**Cost**: RD_PRO tier (~$0.22 per generation)

**Example Use Cases**:
- Fixing palette issues on generated assets
- Adding details to existing sprites
- Modifying character expressions/poses

---

### rd_pro__pixelate

**Best For**:
- Converting reference images to pixel art
- Pixelating photographs or high-res art as style transfer

**Cost**: RD_PRO tier (~$0.22 per generation)

**Size Range**: 96×96 to 256×256

---

### rd_pro__hexagonal_tiles

**Best For**:
- Hexagonal grid tilesets (strategy games, board games)
- Hex-based terrain generation

**Cost**: RD_PRO tier (~$0.22 per generation)

**Note**: Not applicable to Summoning Chamber (non-hex interface).

---

### rd_pro__fps_weapon

**Best For**:
- First-person weapon sprites (doom-style)
- Held-item views from player perspective

**Cost**: RD_PRO tier (~$0.22 per generation)

**Note**: Not applicable to Summoning Chamber (no FPS perspective).

---

## Animation Presets

### animation__any_animation

**Best For**:
- General-purpose animations (64×64 only)
- Spinners and loaders
- Simple looping effects (candle flicker, ember glow)

**Quality Characteristics**:
- Frame-by-frame sprite sheet output
- Loop-friendly (first and last frames designed to connect)

**Cost**: RD_ANIMATION tier (~$0.07–$0.25 per animation)

**Size Constraint**: 64×64 square only

**Example Use Cases**:
- Loading spinner
- Candle flicker (static PNG for MVP, GIF post-MVP)
- Ember glow spots

---

### animation__vfx

**Best For**:
- Visual effects sprite sheets (24–96px square)
- Magic effects (sparkles, smoke, energy)
- Impact effects (explosions, hits, splashes)
- Environmental effects (rain, snow, fog)

**Quality Characteristics**:
- VFX-optimized sprite sheets
- Alpha channel support for overlay blending
- Timing-friendly frame counts

**Cost**: RD_ANIMATION tier (~$0.07–$0.25 per animation)

**Size Range**: 24–96px square

**Example Use Cases**:
- Magic sparkle effects
- Smoke puffs
- Energy bursts
- Impact flashes

---

### animation__walking_and_idle

**Best For**:
- Character idle animations (48×48 only)
- Character walk cycles
- Simple character motion loops

**Quality Characteristics**:
- Character-optimized sprite sheets
- Idle and walk cycle frames
- Loop-friendly timing

**Cost**: RD_ANIMATION tier (~$0.07–$0.25 per animation)

**Size Constraint**: 48×48 square only

**Example Use Cases**:
- Character idle breathing loops
- 4-direction walk cycles
- Simple character animations

---

### animation__8_dir_rotation

**Best For**:
- 8-directional character rotation sprites (80×80)
- Top-down RPG character facing directions
- Isometric character rotation sheets

**Quality Characteristics**:
- 8 facing directions in organized sprite sheet
- Consistent character proportions across all angles
- Clean rotation transitions

**Cost**: RD_ANIMATION tier (~$0.07–$0.25 per animation)

**Size Constraint**: 80×80 square

**Example Use Cases**:
- Top-down RPG character sprites (8 facing directions)
- Isometric unit rotations
- Tower defense enemy facing variants

---

### animation__small_sprites

**Best For**:
- Tiny animated sprites (32×32)
- Particle-scale animated objects
- Small UI indicators and micro-animations

**Quality Characteristics**:
- Optimized for extreme small sizes
- Maximum clarity at minimal resolution
- Simple but effective animation loops

**Cost**: RD_ANIMATION tier (~$0.07–$0.25 per animation)

**Size Constraint**: 32×32 square

**Example Use Cases**:
- Tiny particle animations
- Small status indicators
- Micro-sprite animations for UI accents

---

## Style Creation API (NEW — March 2026)

### Overview

Create **custom reusable styles** that bake in generation parameters, eliminating per-call boilerplate. Custom styles persist across sessions and can be shared.

### Endpoint

```
POST   https://api.retrodiffusion.ai/v1/styles     — Create
PATCH  https://api.retrodiffusion.ai/v1/styles/{id} — Update
DELETE https://api.retrodiffusion.ai/v1/styles/{id} — Delete
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | YES | Style name (becomes `user__[name]_[id]`) |
| `description` | string | no | Internal documentation |
| `style_icon` | string | no | Icon identifier (e.g., "castle", "crystal", "swordman") |
| `reference_images` | base64[] | no | Max 1 reference image for visual consistency |
| `reference_caption` | string | no | Describes what the reference represents |
| `apply_prompt_fixer` | boolean | no | Enable/disable LLM prompt expansion |
| `llm_instructions` | string | no | Custom prompt expansion rules |
| `expanded_llm_instructions` | string | no | Extended prompt guidance |
| `user_prompt_template` | string | no | Template wrapping user prompts (use `{prompt}` placeholder) |
| `force_palette` | base64 | no | Palette PNG baked into every generation |
| `force_bg_removal` | boolean | no | Background removal on every generation |
| `min_width` / `min_height` | int | no | Minimum dimensions (96-256) |

### Strategic Value for Project Workflows

**Before custom styles** (current workflow):
```python
client.generate(
    prompt="crystal ball on stand",
    style="rd_plus__skill_icon",
    width=64, height=64,
    land="seelie_groves",    # → looked up, encoded, sent as input_palette
    remove_bg=True,
    dark_mood=True,          # → appended keywords to prompt
)
```

**After custom styles** (proposed):
```python
client.generate(
    prompt="crystal ball on stand",
    style="user__sc_seelie_icon_abc123",
    width=64, height=64,
)
```

All dark mood keywords, palette enforcement, and bg removal encoded in the style definition.

### Recommended Custom Styles for Summoning Chamber

| Style Name | `force_palette` | `force_bg_removal` | `user_prompt_template` | Use Case |
|-----------|----------------|-------------------|----------------------|----------|
| `sc_icon_[land]` | Land palette | `true` | `{prompt}, medieval dark fantasy icon, centered, strong silhouette, dark muted tones, weathered` | Per-Land icons |
| `sc_scene_[land]` | Land palette | `false` | `{prompt}, medieval dark fantasy interior, VGA pixel art, very dark, dim torch glow` | Per-Land scenes |
| `sc_character` | Neutral dark | `true` | `{prompt}, dark medieval pixel art character, centered, full body, muted tones` | Character sprites |

11 Lands × 2 types (icon + scene) + 1 character = **23 custom styles** covering all standard generation.

### Integration Notes

- Custom styles return `prompt_style` value for use in inference calls
- Style ID format: `user__[name]_[auto_id]` — store the full ID after creation
- `rd_api.py` will need a `create_style()` / `list_styles()` / `delete_style()` method
- Consider caching style IDs in a local config file to avoid re-querying

---

## Selection Decision Tree

### Step 1: Identify Asset Category

| Asset Type | Stream | Go to Step 2 |
|------------|--------|--------------|
| Background, environment, scene | **Stream A** | Atmospheric Presets |
| Character, sprite, prop, icon | **Stream B** | Clean Presets |
| Furniture, UI, large prop | **Stream C** | Hybrid Presets |
| Animation, effect | **Animation** | Animation Presets |

### Step 2: Refine by Detail Level and Budget

**Stream A (Atmospheric)**:
- **High detail, hero asset** → `rd_pro__fantasy` or `rd_pro__horror`
- **Mid detail, budget-conscious** → `rd_plus__environment`
- **Seamless tiles** → `rd_tile__single_tile` or `rd_tile__tileset`

**Stream B (Clean)**:
- **Large subject, maximum detail** → `rd_pro__default`
- **Small subject, extreme clarity** → `rd_pro__simple`
- **Heraldic/emblem** → `rd_plus__classic`
- **UI icon** → `rd_plus__skill_icon`
- **Top-down object** → `rd_plus__topdown_item`
- **Detailed inventory item** → `rd_pro__inventory_items` (NEW)
- **Multi-frame sprite sheet** → `rd_pro__spritesheet` (NEW)

**Stream C (Hybrid)**:
- **Furniture/large props** → `rd_pro__fantasy` (hybrid prompt pattern)
- **UI chrome, fast iteration** → `rd_fast__ui`
- **UI chrome, detailed** → `rd_plus__ui_element`
- **UI chrome, maximum detail** → `rd_pro__ui_panel` (NEW)
- **Pixel art text/titles** → `rd_pro__typography` (NEW)

**Animation**:
- **General loop (64×64)** → `animation__any_animation`
- **VFX (24–96px)** → `animation__vfx`
- **Character motion (48×48)** → `animation__walking_and_idle`
- **8-direction rotation (80×80)** → `animation__8_dir_rotation` (NEW)
- **Tiny sprites (32×32)** → `animation__small_sprites` (NEW)

### Step 3: Pair with Appropriate Parameters

**All Atmospheric (Stream A)**:
- REQUIRED: `input_palette` with dark/muted palette
- Recommended: Dark prompt keywords ("very dark", "dim lighting", "weathered worn")

**All Clean (Stream B)**:
- REQUIRED: `remove_bg: true` (transparent background)
- Recommended: `reference_images` for character consistency
- Recommended: `seed` for reproducible results

**All Hybrid (Stream C)**:
- Recommended: `input_palette` for palette compliance
- Recommended: Material keywords in prompt ("carved oak", "hammered bronze")

---

## Quality Validation per Stream

### Stream A (Atmospheric) — Quality Checklist

- [ ] Depth cues present (foreground/midground/background distinction)
- [ ] Material textures visible (stone grain, wood knots, fabric weave)
- [ ] Dithering appropriate (Floyd-Steinberg or similar, not smooth gradients)
- [ ] Dark/muted palette maintained (not bright by default)
- [ ] Atmospheric lighting (visible light source, natural falloff)

### Stream B (Clean) — Quality Checklist

- [ ] Silhouette clear and recognizable at 50% scale
- [ ] Hard pixel edges (no anti-aliasing)
- [ ] Transparent background clean (no fringe, artifacts)
- [ ] Flat or minimal shading (1–3 shades per color region)
- [ ] Strong color separation (distinct regions, not dithered scatter)

### Stream C (Hybrid) — Quality Checklist

- [ ] Individual objects distinct (each piece identifiable)
- [ ] Material texture visible but not overwhelming
- [ ] Functional details present (hinges, handles, decorations)
- [ ] Balance between atmospheric integration and graphic clarity
- [ ] Usable as scene element or standalone asset

---

## Common Preset Selection Mistakes

### Mistake 1: Using Clean Preset for Backgrounds

**Problem**: `rd_pro__default` generates clean sprites, not atmospheric scenes
**Symptom**: Background looks like a flat prop, lacks depth
**Fix**: Use `rd_pro__fantasy` (Stream A) for environments

### Mistake 2: Using Atmospheric Preset for Icons

**Problem**: `rd_pro__fantasy` adds too much texture detail for small icons
**Symptom**: Icon becomes noisy, loses clarity at 64×64
**Fix**: Use `rd_plus__skill_icon` (Stream B) for UI icons

### Mistake 3: Not Pairing Atmospheric Presets with Dark Palettes

**Problem**: `rd_pro__fantasy` defaults to bright saturated colors
**Symptom**: Output looks like modern indie pixel art, not VGA-era dark fantasy
**Fix**: Always pair Stream A presets with `input_palette` containing dark/muted colors + dark prompt keywords

### Mistake 4: Using Hybrid Preset for Pure Characters

**Problem**: `rd_pro__fantasy` (hybrid mode) expects compositional complexity
**Symptom**: Character generation adds unwanted background elements or props
**Fix**: Use `rd_pro__default` (Stream B) with `remove_bg: true` for clean character sprites

### Mistake 5: Wrong Animation Preset for Size

**Problem**: Using `animation__any_animation` for 32×32 icon animation
**Symptom**: Size constraint violation (only supports 64×64)
**Fix**: Use `animation__vfx` which supports 24–96px range

---

## Cost Optimization Strategies

### Strategy 1: Prototype with Lower Tier, Produce with Higher

1. Use `rd_fast__ui` or `rd_plus__environment` for rapid iteration
2. Once composition/design is approved, regenerate with `rd_pro__fantasy` or `rd_pro__default`
3. Saves cost on exploration phase

**Example**: UI panel design — iterate with rd_fast__ui ($0.015–$0.025), finalize with rd_plus__ui_element ($0.025–$0.05)

### Strategy 2: Batch Icon Generation with Single Tier

Use `rd_plus__skill_icon` consistently for all icons (discovered 2 credits per icon in Session 11 — 50–70% cheaper than estimated).

**Proven Pattern**:
- Generate 2–3 variations per icon
- User selects best
- Consistent style across icon set

### Strategy 3: Reference Image Reuse

Once you have an approved character sprite:
1. Use it as reference image for all class variants of that denizen
2. Locks appearance across 5–10 generations
3. Eliminates regeneration due to inconsistent character design

**Cost Impact**: 1 RD_PRO character generation (~$0.22) enables 5–10 consistent variants without visual rework

---

## Integration with Validation Workflow

After generation with any preset:

1. **VGA Compliance Check** (`validate_asset.py`)
   - Hard edges (all streams)
   - No smooth gradients (all streams)
   - Appropriate dithering (Stream A only)

2. **Palette Compliance Check** (`check_palette.py`)
   - Land/theme palette adherence
   - Dark/muted constraint (if applicable)

3. **Stream-Specific Validation**:
   - **Stream A**: Depth cues, material texture, atmospheric lighting
   - **Stream B**: Silhouette test (50% scale), clean transparency
   - **Stream C**: Individual object clarity, functional detail, balance

4. **Iterate if Needed**:
   - If quality gates fail, identify which constraint was violated
   - Adjust prompt, parameters, or try alternate preset within same stream
   - Document success/failure pattern in generation log

---

## Summary: Quick Reference Table

| Asset Type | Resolution | Best Preset | Cost | Key Parameters |
|------------|-----------|-------------|------|----------------|
| **Land Backdrop** | 1920×1080 | `rd_pro__fantasy` | $0.22 | `input_palette` (dark), atmospheric keywords |
| **Character Sprite** | 256×256 | `rd_pro__default` | $0.22 | `remove_bg: true`, `reference_images` (up to 9) |
| **Furniture Overlay** | 1920×1080 | `rd_pro__fantasy` | $0.22 | `input_palette`, material keywords, hybrid prompt |
| **Heraldic Crest** | 128×128 | `rd_plus__classic` | $0.025–$0.05 | Symmetry keywords, simple shading |
| **Inventory Icon** | 64×64 | `rd_plus__skill_icon` | $0.025–$0.05 | `remove_bg: true`, clear silhouette prompt |
| **Equipment Object** | 64×64 | `rd_plus__topdown_item` | $0.025–$0.05 | `remove_bg: true`, top-down perspective |
| **UI Panel (basic)** | Variable | `rd_fast__ui` | $0.015–$0.025 | 9-slice friendly, geometric shapes |
| **UI Panel (hero)** | 96–256px | `rd_pro__ui_panel` | $0.22 | Ornate medieval styling (NEW) |
| **Inventory Item (detailed)** | 96–256px | `rd_pro__inventory_items` | $0.22 | Material texture, detailed items (NEW) |
| **Typography** | 96–256px | `rd_pro__typography` | $0.22 | Pixel art text/lettering (NEW) |
| **Sprite Sheet** | 96–256px | `rd_pro__spritesheet` | $0.22 | Multi-frame organized grids (NEW) |
| **Seamless Tile** | 16–64px | `rd_tile__single_tile` | $0.10 | Uniform density, no directional flow |
| **Tileset** | Variable | `rd_tile__tileset` | $0.10 | Wang combinations, edge matching |
| **Animation** | 64×64 | `animation__any_animation` | $0.07–$0.25 | Loop-friendly frames |
| **VFX** | 24–96px | `animation__vfx` | $0.07–$0.25 | Alpha channel, overlay blending |
| **8-Dir Rotation** | 80×80 | `animation__8_dir_rotation` | $0.07–$0.25 | 8 facing directions (NEW) |
| **Small Sprites** | 32×32 | `animation__small_sprites` | $0.07–$0.25 | Tiny animated sprites (NEW) |

---

*This preset mapping is project-agnostic. Adapt stream assignments and quality priorities to your specific visual requirements.*

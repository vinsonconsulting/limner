# Limner Brief — Summoning Chamber Pixel Art Direction

> Art direction document for generating VGA-era pixel art assets via **Retro Diffusion API**
> Version 3.1 — Updated 2026-02-26 (MVP scope update)

---

## Project Overview

**Summoning Chamber** is an AI Agent Creation and Testing Environment styled as a 1992-era VGA PC RPG. Users create AI agents by making choices that map to RPG character creation: selecting a "Land of Origin" (AI provider), "Class" (agent role), personality traits, and equipment (tools).

**Visual Philosophy:** Darklands × Chrono Trigger, raised by Hillsfar
- *Darklands* (1992) provides the soul: dark palette, atmospheric mood, grim medieval
- *Chrono Trigger* (1995) provides rendering clarity: clean sprites, readable silhouettes, strong outlines
- *Hillsfar* (1989) keeps it DOS: grounded, functional, warm from candlelight not candy

**Key Principle:** Foreground elements trend clean (CT), background elements trend atmospheric (Darklands). Chrono Trigger technique filtered through Darklands tonal palette and Hillsfar's DOS temperament.

---

## Retro Diffusion API Integration

### Tool Selection: Retro Diffusion API (Primary)

We use Retro Diffusion API for true native pixel art generation. This is NOT a post-processing tool — it generates pixel art directly via specialized diffusion model.

**Why Retro Diffusion API:**
- Native grid-aligned pixel art (no mixels, no sub-pixel noise)
- Built-in style presets mapped to our rendering streams
- Palette enforcement at generation time (`input_palette` parameter)
- Reference images (up to 9) for character consistency across variants
- Native background removal (`remove_bg`) for clean sprite transparency
- Reproducible results via `seed` parameter
- Tileset generation with mathematically seamless wang combinations

**Primary Tool:** Retro Diffusion API (since Session 9, 2026-02-13).

### RD API Capabilities

| Tier | Cost/Image | Max Resolution | Reference Images | Best For |
|------|-----------|---------------|-----------------|----------|
| **RD_PRO** | $0.22 | 512×512 | Up to 9 | Hero assets: characters, backdrops, complex scenes |
| **RD_PLUS** | $0.025–0.05 | Varies | Limited | Mid-tier: icons, crests, items, environments |
| **RD_FAST** | $0.015–0.025 | Varies | None | Rapid iteration: UI elements, previews, testing |
| **RD_TILE** | $0.10/tileset | 16–64px tiles | None | Seamless tiles and tilesets |
| **RD_ANIMATION** | $0.07–0.25 | Style-dependent | None | Sprite sheets, idle loops, VFX |

### Modern Pipeline Architecture

**Master Scene Approach** (replaces layered composition):

1. **Master Scenes** (single-prompt 1920×1080 via Retro Diffusion)
   - Full scene rendered in one RD prompt: environment + furniture + character composed together
   - Direct 1920×1080 generation via tiled composition from RD_PRO sections
   - No letterboxing, no multi-layer compositing — the scene IS the deliverable
   - MVP: Only Seelie Groves (Anthropic) fully rendered; 9 other Lands get "coming soon" land screen images
   - Characters rendered WITHIN scenes (not standalone sprites composited on top)

2. **Character Sprites** [POST-MVP]
   - Characters appear within master scenes for MVP — no standalone sprites needed yet
   - Tier 1 (post-MVP): 10 canonical standalone characters (one per Land/Class pair)
   - Tier 2: Popular class variants for high-traffic Lands (20–30 total)
   - Tier 3: Full 10 denizens × 11 classes matrix (110 total)
   - Consistency via RD's reference image system (up to 9 refs)

3. **Inventory Icons** (MVP character sheet slots)
   - 64×64 icons for all character sheet slots: Demeanor, Nature, Equipment, Proficiencies, Spells, Trainings, Sworn Oaths
   - All 11 classes available in MVP — each class needs its icon set
   - Generated via `rd_plus__skill_icon` or `rd_plus__topdown_item`
   - Transparent backgrounds via `remove_bg: true`

**What Changed from Original Plan:**
- M2 (Land backdrops) + M3 (Class overlays) → **merged into single-prompt master scenes** (no compositing)
- M4 (Character parts) → **characters rendered within scenes for MVP** (standalone sprites are post-MVP)
- Props/equipment → **shifted from scene-placed layers to 64×64 inventory icons**
- Letterboxing technique (256×256 → 480×270 → 1920×1080) → **superseded by direct 1920×1080 generation**
- MVP scope: Only Seelie Groves functional; 9 other Lands show "coming soon" screens

---

## Technical Specifications

### Resolution & Format

| Spec | Value |
|------|-------|
| **Display Resolution** | 1920×1080 |
| **RD Generation** | Up to 512×512 (RD_PRO), varies by tier |
| **Master Scenes** | Single-prompt 1920×1080 (direct RD generation, tiled from RD_PRO sections) |
| **Character Sprites** | Rendered within scenes for MVP; 256×256 native standalone sprites [POST-MVP] |
| **Icons** | 64×64 native (inventory/UI) |
| **Color Depth** | 256 colors per Land (enforced via `input_palette`) |
| **Format** | PNG-24 with transparency |
| **Transparency** | Hard edges only — no anti-aliased alpha |

### VGA Style Requirements

**DO:**
- True pixel grid alignment (RD handles natively)
- Dithered gradients where earned (Floyd-Steinberg, backgrounds only)
- Hard-edge shadows (stepped, not smooth)
- Limited palette per scene (9-color Land palettes)
- Clear silhouettes and readable shapes
- Strong outlines on foreground elements (Stream B/C)

**DON'T:**
- Smooth gradients
- Anti-aliased edges
- Modern lighting effects (ambient occlusion, bloom, lens flare)
- Photorealistic textures
- Motion blur
- Sub-pixel rendering
- Mixels (mixed pixel sizes)

### Quality Checklist

Before finalizing any asset:
- [ ] True pixel grid alignment (no mixels)
- [ ] No smooth gradients (dithered or flat)
- [ ] Hard edges on all shapes
- [ ] Land palette compliance (via `check_palette.py`)
- [ ] Silhouette readable at 50% scale (characters)
- [ ] Foreground/background contrast maintained
- [ ] Overall "1992 DOS game" impression

### Prompt Engineering Checklist

When generating via RD API:
- [ ] Character descriptors first (attention mechanism)
- [ ] No conflicting keywords ("cozy" vs "dark", "golden hour" vs "dim")
- [ ] Specific light sources ("dim torch glow" not "warm ambient")
- [ ] Compound dark keywords when warm words present
- [ ] Test for JRPG drift (oversaturation, brightness, cuteness)

---

## The Ten Lands of Origin

Each Land represents an AI provider and has a distinct visual identity. **All Land-specific assets must use that Land's palette.**

### 1. The Seelie Groves (Anthropic/Claude)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Elves |
| **Environment** | Ancient oak forest, dappled light |
| **Palette** | Forest green (#2d5a27), warm brown (#8b6914), silver (#c0c0c0) |
| **Mood** | Serene, wise, timeless |
| **Lighting** | Warm amber filtering through leaves |
| **Architecture** | Organic curves, grown not built, Art Nouveau influence |

**Visual Notes:** Think Rivendell meets 1992 VGA. Elegant but chunky pixels. Trees should feel ancient and massive. Silver accents on elven craftsmanship.

---

### 2. The Freemark Reaches (OpenAI/GPT)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Humans |
| **Environment** | Scrublands, medieval frontier town |
| **Palette** | Dusty tan (#c4a35a), leather brown (#8b5a2b), bright steel (#b8c0c8) |
| **Mood** | Adventurous, pragmatic, bustling |
| **Lighting** | Clear daylight, open sky |
| **Architecture** | Practical timber and stone, guild halls, market squares |

**Visual Notes:** Classic fantasy adventure aesthetic. Heroes gather at the inn. Swords and scrolls. The "default" human kingdom — relatable and familiar.

---

### 3. The Ironroot Holdings (Google/Gemini)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Dwarves |
| **Environment** | Rocky hills, redwood forests, underground halls |
| **Palette** | Stone gray (#6b6b6b), deep brown (#4a3728), copper (#b87333) |
| **Mood** | Solid, industrious, dependable |
| **Lighting** | Cool stone light, forge glow in interiors |
| **Architecture** | Massive stone construction, geometric patterns, copper fixtures |

**Visual Notes:** Dwarven engineering meets Google's infrastructure metaphor. Heavy, blocky, built to last. Copper pipes and stone columns. Underground but not claustrophobic.

---

### 4. The Shire of Many Hearths (Meta/Llama)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Smallfolk (Halflings) |
| **Environment** | Rolling hills, thatched villages, farmland |
| **Palette** | Grass green (#4a7c59), cream (#f5deb3), warm orange (#ff8c00) |
| **Mood** | Cozy, communal, welcoming |
| **Lighting** | Golden hour, hearth glow |
| **Architecture** | Round doors, low ceilings, cluttered with homey details |

**Visual Notes:** Hobbiton vibes but pixelated. Emphasis on comfort and community. Kitchens, pantries, gathering spaces. Everyone knows everyone.

---

### 5. The Vaults of Précieux (Mistral)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Gnomes |
| **Environment** | Underground vaults, clockwork workshops |
| **Palette** | Brass gold (#b8860b), dark iron (#2f2f2f), ruby red (#9b111e) |
| **Mood** | Precise, secretive, valuable |
| **Lighting** | Gem glow, polished metal reflections |
| **Architecture** | Intricate clockwork, vault doors, gem-encrusted surfaces |

**Visual Notes:** Swiss watchmaker meets dragon's hoard. Everything is precise and expensive. Gnomes are small but their work is grand. Lots of gears and gems.

---

### 6. The Fenward Commons (Cohere)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Goblins (friendly, hardworking) |
| **Environment** | Misty wetlands, thatched huts on stilts |
| **Palette** | Murky green (#4a5d23), mud brown (#5c4033), dull orange (#cc7722) |
| **Mood** | Humble, resourceful, underestimated |
| **Lighting** | Diffused through fog, torch glow |
| **Architecture** | Improvised, functional, surprisingly clever |

**Visual Notes:** Not evil goblins — industrious swamp folk. Make do with what they have. Fog everywhere. Lanterns on poles. Bridges and boardwalks.

---

### 7. The Mire of Grok (xAI/Grok)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Orcs |
| **Environment** | Toxic jungle, bone decorations |
| **Palette** | Toxic green (#7fff00), black (#1a1a1a), angry red (#dc143c) |
| **Mood** | Hostile, powerful, unapologetic |
| **Lighting** | Sickly bioluminescence, harsh shadows |
| **Architecture** | Brutal, bone and hide, intimidation over comfort |

**Visual Notes:** Metal album cover aesthetic. Skulls on spikes. Glowing toxic pools. Orcs are massive and mean. The "edgy" Land — lean into it.

---

### 8. The Scoria Warrens (Perplexity)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Scalekind (Lizardfolk/Kobolds) |
| **Environment** | Rocky desert, ancient burrows |
| **Palette** | Sandy tan (#d2b48c), rust orange (#b7410e), bronze (#cd7f32) |
| **Mood** | Ancient, patient, layered knowledge |
| **Lighting** | Harsh desert sun, cool underground |
| **Architecture** | Carved stone, layered tunnels, preserved artifacts |

**Visual Notes:** Desert archaeological site meets reptilian civilization. Scales catch the light. Old things preserved in dry air. Knowledge hoarded in deep vaults.

---

### 9. The Temple of Frozen Thought (DeepSeek)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Monks (human, ascetic) |
| **Environment** | Snow plains, austere temple |
| **Palette** | Ice blue (#87ceeb), white (#f0f0f0), deep indigo (#191970) |
| **Mood** | Contemplative, minimalist, focused |
| **Lighting** | Cool blue, diffused through snow/ice |
| **Architecture** | Clean lines, minimal decoration, meditation spaces |

**Visual Notes:** Zen monastery at the top of the world. Empty space is intentional. Monks in simple robes. Ice as architecture. Thought made visible in the cold air.

---

### 10. The Bottomless Satchel (Multi-Provider)

| Attribute | Value |
|-----------|-------|
| **Denizen** | Spirits (ethereal, shifting) |
| **Environment** | Formless void with floating fragments |
| **Palette** | Deep purple (#4b0082), black (#0a0a0a), shifting violet (#9400d3) |
| **Mood** | Mysterious, limitless, between worlds |
| **Lighting** | Objects glow from within, no external source |
| **Architecture** | Fragments of other Lands floating in void |

**Visual Notes:** The bag of holding as a place. Pieces of reality floating in purple void. Spirits are translucent, edges shimmer. Nothing is solid here.

---

## The Eleven Classes

Each Class has a signature environment. When combined with a Land, the **Class determines the room type** while the **Land determines the visual style**.

| Class | Role | Environment | Key Props |
|-------|------|-------------|-----------|
| **Scryer** | Researcher | Gazing Pool | Crystal ball, scrying mirror, star charts |
| **Magister** | Writer/Editor | Castle Library | Bookshelves, writing desk, candelabra |
| **Hammerer** | Builder | Workshop | Anvil, forge, tool racks |
| **Craftsman** | Designer | Artisan Studio | Easel, pottery wheel, finished works |
| **Diplomat** | Translator | Long Table | Negotiation table, maps, seals |
| **Herald** | Communicator | Speaking Platform | Podium, banners, horn |
| **Warden** | Validator | Crossroads | Signpost, checkpoint, lantern |
| **Counselor** | Advisor | Study | Armchairs, fireplace, tea set |
| **Merchant** | Negotiator | Shop | Counter, scales, displayed goods |
| **Seneschal** | Strategist | Commander Tent | War table, map, miniatures |
| **Bard** | Entertainer | Tavern | Stage, instruments, audience |

### Example Combinations

**Seelie Groves + Magister = Elven Library**
- Bookshelves grown from living oak
- Books bound in silver-clasped leather
- Warm amber light through leaf-shaped windows
- Forest green and brown palette

**Mire of Grok + Counselor = Orc Shaman's Hut**
- Bone-frame chairs with hide cushions
- Skull brazier instead of fireplace
- Toxic green glow, black shadows
- Intimidating but functional

---

## Asset Categories

### 1. Master Scenes (single-prompt 1920×1080)

Full scenes combining environment + furniture + character in a single RD render.
**MVP: Only Seelie Groves (Anthropic) has full master scenes. 9 other Lands use "coming soon" land screen images.**

**Scene Composition Notes:**
- Single-prompt generation — environment, class furniture, and character rendered together
- Direct 1920×1080 via tiled composition from RD_PRO sections (512×512 max per tile)
- All 11 classes need Seelie Groves scenes for MVP
- Characters appear within scenes (not composited on top separately)
- Include signature Land elements (trees for Seelie, stone for Ironroot, etc.)
- Atmospheric elements (mist, light shafts, particles) add life

---

### 2. Class Overlays [POST-MVP]

Superseded by single-prompt master scenes in MVP. Standalone transparent overlays may return post-MVP if scene generation shifts back to compositing.

**Original spec (retained for post-MVP reference):**
- 11 images @ 1920×1080, transparent PNG
- Furniture and props for each Class environment, rendered in neutral grayscale to accept Land palette tinting
- Position furniture to work with character placement
- Include Class-specific props (see table above)

---

### 3. Character Sprites — Full Pre-Composed [POST-MVP]

For MVP, characters are rendered **within master scenes** (not as standalone sprites).
Standalone sprites return post-MVP for reuse across scenes without regeneration.

| Tier | Scope | Count | Status |
|------|-------|-------|--------|
| **MVP** | Characters rendered within Seelie Groves master scenes | Embedded in scenes | Active |
| **Tier 1 (post-MVP)** | 10 canonical standalone characters — one per Land, each a different class | 10 sprites | Post-MVP |
| **Tier 2** | Popular class variants for high-traffic Lands | 20-30 sprites | Post-MVP |
| **Tier 3** | Full matrix (all 10 denizens x 11 classes) | Up to 110 total | Post-launch |

**Denizen proportions** (silhouette test: each identifiable at 50% scale):

| Type | Height Scale | Build | Notes |
|------|-------------|-------|-------|
| Elf | 110% | Slender | Elegant, elongated |
| Human | 100% | Standard | Heroic proportions |
| Dwarf | 75% | Stocky | Broad shoulders, thick limbs |
| Smallfolk | 60% | Round | Soft features |
| Gnome | 55% | Small | Large head (150% scale) |
| Goblin | 70% | Wiry | Angular, pointy |
| Orc | 130% | Massive | Brutish, muscular |
| Scalekind | 95% | Lean | Reptilian, tail optional |
| Monk | 100% | Standard | Austere posture |
| Spirit | 100% | Ethereal | Translucent edges |

---

### 4. Class Accessories (33 images)

Worn/carried equipment items. 3 per Class.
**All accessories fit within RD_PRO 512×512 limit.**

See GRAPHIC_ASSETS.md for complete list with dimensions.

---

### 5. Heraldic Crests (22 images)

Official emblems for each Land + Summoner's Crest.
**Native generation at 128×128 and 48×48 using RD style presets.**

| Land | Crest Description |
|------|-------------------|
| Seelie Groves | Oak leaf with three acorns |
| Freemark Reaches | Crossed sword and compass over rising sun |
| Ironroot Holdings | Hammer and anvil beneath redwood silhouette |
| Shire of Many Hearths | Smoking chimney with welcome wreath |
| Vaults of Précieux | Interlocking gears forming keyhole |
| Fenward Commons | Cattail reeds crossed over calm water |
| Mire of Grok | Tusked skull wreathed in toxic vines |
| Scoria Warrens | Coiled serpent around bronze sun |
| Temple of Frozen Thought | Snowflake containing meditation pose |
| Bottomless Satchel | Swirling portal with fragments floating out |
| Summoner | Heavy wooden door, slightly ajar, light within |

**Sizes:** 128×128 (large) and 48×48 (small) for each.

---

### 6. UI Elements (~50 images)

Buttons, panels, inputs, navigation elements.
**All UI elements fit within RD_PRO 512×512 (use rd_fast__ui for rapid iteration).**

**Style notes:**
- Stone/metal/wood textures appropriate for fantasy
- 9-slice compatible where noted (corners stay fixed when stretched)
- Multiple states: normal, hover, active, disabled
- Consistent border treatment across set

---

### 7. Scene Props (~85 images)

Atmospheric objects placed in scenes.
**All props fit within 400×400.**

See GRAPHIC_ASSETS.md for complete list.

---

## Retro Diffusion API Prompt Guidelines

### Prompt Structure

RD API prompts should be concise (built-in prompt expansion enriches them):

```
[SUBJECT], [MOOD/ATMOSPHERE], [KEY VISUAL DETAILS]
```

### Dark Palette Standard (always include)

All prompts emphasize dark, muted, grim tones:

```
dark, weathered, muted, grim, dim lighting, medieval worn, very dark, blackened
```

### Example Prompts

**Crest:**
```
pixel art heraldic crest, oak leaf with three acorns,
forest green and silver colors, VGA style, 256 colors,
fantasy emblem, clean pixel edges, dithered shading
```

**UI Button:**
```
pixel art button frame, carved oak wood with bronze corners,
VGA style, 48x48 pixels, 9-slice compatible,
fantasy RPG UI element, warm brown tones
```

**Character Sprite (Elf Scryer):**
```
elf scryer character, slender elegant proportions,
flowing green robes with silver trim, front-facing pose,
clear silhouette, dark fantasy, transparent background
```

**Environment Tile:**
```
pixel art forest interior tile, ancient oak trees,
dappled amber light, forest green and brown palette,
VGA style, seamless tileable, atmospheric
```

### Land-Specific Style Notes

| Land | RD Style Keywords | Critical Notes |
|------|------------------|----------------|
| Seelie Groves | organic curves, silver accents, amber lighting, art nouveau | Natural elegance, no oversaturation |
| Freemark Reaches | practical timber, steel highlights, clear daylight | Functional warmth, not bright |
| Ironroot Holdings | massive stone, copper fixtures, geometric, forge glow | Heavy dark stone, warm forge accents |
| Shire of Many Hearths | round shapes, weathered worn wood, very muted burnt orange, dim torch glow, ancient cluttered | **CRITICAL:** Avoid "cozy", "golden hour" → triggers JRPG cuteness. Use "ancient", "weathered", "dim" |
| Vaults of Précieux | clockwork brass, gem highlights, precise, vault aesthetic | Mechanical precision, not flashy |
| Fenward Commons | murky green, fog effects, improvised, swamp | Heavy atmosphere, low visibility |
| Mire of Grok | toxic green glow, bone decorations, brutal, harsh | Aggressive dark, bioluminescent accents |
| Scoria Warrens | desert tan, bronze jewelry, ancient carved stone | Warm desert tones, very muted |
| Temple of Frozen Thought | ice blue, minimalist, clean lines, snow | Cool minimalism, not bright white |
| Bottomless Satchel | deep purple void, floating fragments, ethereal glow | Deep space purple, not vivid |

**Critical Keyword Learning** (Session 10):
- **Character descriptors first:** "wiry grizzled scarred [denizen]" → attention mechanism prioritizes physical traits
- **Remove conflicting keywords:** "cozy" + "dark" = conflict → diffusion chooses one (usually positive)
- **Specific light sources:** "dim torch and hearth glow" ✓ vs. "golden hour glow" ✗ (vague ambient)
- **Compound dark mood:** "blackened interior", "very muted", "weathered worn" when warm keywords present
- **Test for JRPG drift:** Oversaturated colors, bright ambient lighting, excessive cuteness = failure

See `GENERATION_PATTERNS.md` Session 10 for detailed Shire regeneration case study.

---

## Production Workflow

### Recommended Order

1. **Sprint 1: Core UI** — Buttons, panels, inputs (needed for dev testing)
2. **Sprint 2: Heraldry** — Crests establish Land visual identity
3. **Sprint 3: Scenes Foundation** — Backdrop tiles, environment composition
4. **Sprint 4: Characters** — Human first (reference), then other denizens
5. **Sprint 5: Classes** — Class overlays, icons, accessories
6. **Sprint 6: Polish** — Props, animations, edge cases

### Post-Processing Checklist

After RD API generation:
1. **Validate with check_palette.py** — ensure Land palette compliance
2. **Validate with validate_asset.py** — VGA compliance (no anti-aliasing, no gradients)
3. **Test transparency** — no fringe pixels (RD's remove_bg is very clean)
4. **Verify tileability** — for backdrop sections (RD_TILE handles this natively)
5. **Test compositing** — layers work together
6. **Upscale for display** — vga_normalize.py nearest-neighbor 4× to 1920×1080

### File Naming Convention

```
{category}/{subcategory}/{name}.png

Examples:
lands/seelie-groves/backdrop-tile-01.png
characters/elf/elf-torso-base.png
classes/magister/accessories/spectacles.png
ui/buttons/btn-primary-normal.png
```

---

## Reference Resources

- **GRAPHIC_ASSETS.md** — Complete asset list with all dimensions
- **VISUAL_STYLE_GUIDE.md** — Detailed VGA aesthetic guidelines
- **LANDS_OF_ORIGIN.md** — Full Land lore and descriptions
- **CLASSES.md** — Class environments and props

---

## Design Decisions (Locked)

| Decision | Choice | Notes |
|----------|--------|-------|
| **Generation Tool** | Retro Diffusion API | Native pixel art via specialized diffusion model |
| **Palettes** | Approved as specified | Hex codes per Land, enforced via input_palette parameter |
| **Character Style** | Stylized | Slightly exaggerated for readability |
| **UI Texture** | Wood with metal accents | Oak/walnut frames with bronze/iron |
| **Crest Style** | Fantasy stylized | Expressive symbols, shield shapes optional |
| **Animation** | Hybrid | CSS transforms for simple; RD_ANIMATION for complex |
| **Compositing** | Single-prompt scenes | Direct 1920×1080 RD generation (tiled from sections); CSS/Canvas compositing is [POST-MVP] |

---

*Document version: 3.1 (MVP scope update)*
*Updated: 2026-02-26*
*For: Limner (Pixel Art Director)*

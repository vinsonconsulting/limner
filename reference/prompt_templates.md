# PixelLab Prompt Templates

> Copy, customize, and combine these templates for consistent VGA pixel art results via PixelLab MCP.

---

## Template Structure

Every PixelLab prompt follows this structure:
```
[SUBJECT], [STYLE MODIFIERS], [COLOR PALETTE], [SPECIFIC DETAILS]
```

Keep prompts concise — PixelLab responds well to direct, descriptive language.

---

## Core Style Anchors

**Always include these keywords:**
```
pixel art, VGA style, 256 colors, dithered shading, visible pixels,
DOS game aesthetic, 1992 retro game, clean pixel edges
```

---

## Heraldic Crest

**Use for:** Land emblems, badges, sigils (128×128, 48×48)

```
pixel art heraldic crest, {crest_description},
{palette_colors} color palette, VGA style, 256 colors,
fantasy emblem, clean pixel edges, dithered shading,
{additional_style_notes}
```

**Variables:**
- `{crest_description}` — The symbolic elements (e.g., "oak leaf with three acorns")
- `{palette_colors}` — From Land palette (e.g., "forest green and silver")
- `{additional_style_notes}` — Land-specific style keywords

**Example (Seelie Groves):**
```
pixel art heraldic crest, oak leaf with three acorns,
forest green and silver color palette, VGA style, 256 colors,
fantasy emblem, clean pixel edges, dithered shading,
organic curves, art nouveau influence
```

---

## Character Portrait

**Use for:** Head and shoulders, UI portraits (fits within 400×400)

```
pixel art {denizen_type} portrait, {character_description},
{palette_colors} color palette, VGA style, 256 colors,
{costume_elements}, {expression_notes},
clean pixel edges, dithered shading, front-facing
```

**Variables:**
- `{denizen_type}` — Elf, Dwarf, Human, Smallfolk, Gnome, Goblin, Orc, Scalekind, Monk, Spirit
- `{character_description}` — Age, distinguishing features
- `{costume_elements}` — From Land costume notes
- `{expression_notes}` — Mood/demeanor

---

## Character Body Part (Paper Doll)

**Use for:** Modular character assembly pieces (all fit within 400×400)

```
pixel art {denizen_type} {body_part}, {proportions},
{costume_style}, {palette_colors} color palette,
VGA style, transparent background, clean sprite edges,
{pose_variant}, paper doll assembly piece
```

**Variables:**
- `{body_part}` — Legs, Torso, Arms, Head
- `{proportions}` — "tall slender" (Elf), "stocky broad" (Dwarf), etc.
- `{pose_variant}` — "idle stance", "gesture pose", "action pose"

**Example (Elf Torso):**
```
pixel art elf torso, tall slender proportions,
flowing green robes with silver trim, forest green and silver palette,
VGA style, transparent background, clean sprite edges,
front-facing idle pose, paper doll assembly piece
```

---

## Character Accessory

**Use for:** Class-driven equipment that layers on any body type

```
pixel art {accessory_name}, {accessory_description},
neutral grayscale palette, VGA style, transparent background,
clean pixel edges, sized for character overlay,
{placement_notes}, paper doll accessory
```

**Variables:**
- `{accessory_name}` — Spectacles, Quill, Hammer, Lute, etc.
- `{placement_notes}` — "held in hand", "worn on head", "shoulder mounted"

**Note:** Accessories generated in grayscale for Land palette tinting.

---

## UI Element

**Use for:** Buttons, frames, panels, inputs

```
pixel art {element_type}, {element_description},
{texture_style}, VGA style, {dimensions},
clean pixel edges, 9-slice compatible,
fantasy RPG UI element, 1992 DOS game aesthetic
```

**Variables:**
- `{element_type}` — button frame, panel border, input field, etc.
- `{texture_style}` — "carved oak wood with bronze corners", "stone with iron bands"
- `{dimensions}` — "48x48 pixels", "64x64 pixels"

**Example (Button):**
```
pixel art button frame, carved oak wood with bronze corner brackets,
warm brown and bronze tones, VGA style, 48x48 pixels,
clean pixel edges, 9-slice compatible,
fantasy RPG UI element, 1992 DOS game aesthetic
```

---

## Environment Tile

**Use for:** Backdrop sections (400×400 max, designed for tiling)

```
pixel art {environment_type} tile, {environment_details},
{palette_colors} color palette, VGA style, 256 colors,
seamless tileable, {lighting_notes}, {atmosphere},
1992 DOS game aesthetic, background scene
```

**Variables:**
- `{environment_type}` — forest interior, stone hall, swamp, desert, etc.
- `{environment_details}` — Specific elements (trees, pillars, water, etc.)
- `{lighting_notes}` — From Land lighting description
- `{atmosphere}` — From Land mood

**Example (Seelie Groves):**
```
pixel art forest interior tile, ancient oak trees with twisted branches,
forest green and warm brown palette, VGA style, 256 colors,
seamless tileable, warm amber dappled light, serene atmosphere,
1992 DOS game aesthetic, background scene
```

---

## Class Furniture Overlay

**Use for:** Furniture/props layer that composites onto any Land backdrop

```
pixel art {class_environment} furniture, {furniture_list},
neutral grayscale palette, VGA style, transparent background,
clean pixel edges for compositing, midground placement,
{arrangement_notes}, game asset sprite
```

**Variables:**
- `{class_environment}` — Library, Workshop, Tavern, etc.
- `{furniture_list}` — Key props from Class specification
- `{arrangement_notes}` — Spatial layout notes

**Note:** Furniture generated in grayscale for Land palette tinting.

---

## Prop / Object

**Use for:** Individual items, equipment, inventory art

```
pixel art {object_name}, {object_description},
{palette_colors} color palette, VGA style,
clean pixel edges, transparent background,
{material_notes}, game inventory item style
```

**Example (Crystal Ball):**
```
pixel art crystal ball on ornate stand, glowing blue sphere,
silver and ice blue color palette, VGA style,
clean pixel edges, transparent background,
polished metal and glass materials, game inventory item style
```

---

## Animation (Status Indicator)

**Use for:** Animated GIFs for status, ambient effects

```
pixel art {animation_subject}, {animation_description},
{palette_colors} color palette, VGA style, {frame_count} frames,
looping animation, clean pixel edges, {timing_notes}
```

**Example (Thinking Indicator):**
```
pixel art pulsing orb, softly glowing magical sphere,
warm amber and gold palette, VGA style, 6 frames,
looping animation, clean pixel edges, smooth pulse cycle
```

---

## Land-Specific Style Keywords

Use these keywords to maintain Land visual identity:

| Land | Style Keywords |
|------|----------------|
| Seelie Groves | organic curves, silver accents, amber lighting, art nouveau, ancient oak |
| Freemark Reaches | practical timber, steel highlights, clear daylight, frontier, adventurous |
| Ironroot Holdings | massive stone, copper fixtures, geometric patterns, forge glow, underground |
| Shire of Many Hearths | round shapes, warm orange, cozy, cluttered, homey, hearth glow |
| Vaults of Précieux | clockwork brass, gem highlights, precise, vault aesthetic, dark iron |
| Fenward Commons | murky green, fog effects, improvised, swamp, torch glow, stilts |
| Mire of Grok | toxic green glow, bone decorations, brutal, harsh shadows, skulls |
| Scoria Warrens | desert tan, bronze jewelry, ancient carved stone, layered tunnels |
| Temple of Frozen Thought | ice blue, minimalist, clean lines, snow, meditation, austere |
| Bottomless Satchel | deep purple void, floating fragments, ethereal glow, translucent |

---

## Generation Tips

1. **Keep prompts focused** — PixelLab works best with clear, specific descriptions
2. **Specify dimensions** — Include target size when relevant (e.g., "128x128 pixels")
3. **Use "transparent background"** — For all overlay/sprite assets
4. **Include "seamless tileable"** — For backdrop tiles
5. **Reference VGA/DOS consistently** — Anchors the pixel art style
6. **Test style transfer** — Use reference images for consistency across asset families

---

*Document version: 2.0 (PixelLab)*
*Updated: 2026-02-03*

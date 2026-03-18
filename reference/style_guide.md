# Summoning Chamber Style Guide

> The visual rules. Read this before generating any prompt.

## Core Specifications

| Attribute | Value |
|-----------|-------|
| Display Resolution | 1920×1080 (composited) |
| Generation Tool | PixelLab MCP (max 400×400 per asset) |
| VGA Aesthetic | 320×200 *look and feel* |
| Palette | 256-color VGA-style (custom per Land) |
| Dithering | Floyd-Steinberg for organic gradients |
| CRT Effects | Subtle scanlines (user can disable, applied at app level) |
| Primary Influences | Darklands (1992) — scenes, atmosphere, world; Hillsfar (1989) — portraits, UI, crisp pixel work |
| Secondary Influences | Quest for Glory, Ultima VII, Indiana Jones: Fate of Atlantis |

**Note:** We generate assets at PixelLab's 400×400 max and composite them to 1920×1080. The target is the *look and feel* of 320×200 VGA — visible pixels, limited palette, dithered gradients. The aesthetic is the constraint, not the literal resolution.

## What Makes Good VGA Pixel Art

The 1990-1993 sweet spot:
- **Visible pixels** — not smoothed or anti-aliased
- **Dithered gradients** — never smooth blends
- **Limited palette** — creates deliberate color choices
- **Hand-placed feel** — even in generated art
- **Atmospheric lighting through color** — not soft shadows

## Project-Wide Tone: Dark Palette Standard

**APPROVED 2026-02-04** — All assets use this dark, grim medieval aesthetic.

### Dark Palette Keywords (Always Include)
```
very dark
blackened
grim medieval
weathered worn
dark fantasy
very muted shadowy colors
```

### PixelLab Settings for Dark Palette
| Setting | Value |
|---------|-------|
| Detail | low detail |
| Shading | basic shading |
| Outline | single color outline |

### Tone Description
- **Not bright or vibrant** — colors are desaturated and shadowy
- **Weathered and worn** — nothing looks new or pristine
- **Grim medieval** — early medieval, not high fantasy polish
- **Chunky pixels** — low detail setting for authentic VGA feel
- **Muted accent colors** — even highlights are subdued

## PixelLab Style Anchors

### Always Include
```
pixel art
VGA style
256 colors
dithered shading
visible pixels
clean pixel edges
DOS game aesthetic
1992 retro game
```

### Never Describe (PixelLab handles pixel art natively)
```
smooth gradients
modern lighting
photorealistic
3D render
anti-aliased edges
soft shadows
motion blur
```

### Generation Constraints
- **Max canvas:** 400×400 pixels per generation
- **Large scenes:** Generate as tileable sections
- **Characters:** Generate parts separately (all fit within 400×400)
- **Transparency:** Always request "transparent background" for overlays/sprites

## Scene Layer Architecture

Every scene has 7 layers (back to front):

1. **Background** — Walls, sky, distant elements
2. **Midground furniture** — Large objects (shelves, tables)
3. **Props** — Smaller objects, decorations
4. **Equipment objects** — Tool representations (clickable in UI)
5. **Character** — The summoned agent
6. **Foreground** — Frame elements, atmospheric overlays
7. **UI overlay** — Buttons, panels (not in MidJourney prompts)

When generating environment prompts, reference this layering explicitly:
"layered depth: background walls, midground furniture, foreground elements"

## Forbidden Elements

Never include in prompts or approve in output:

- Modern lighting (fluorescent, LED, neon signs)
- Smooth color gradients
- High color depth appearance (millions of colors look)
- Soft shadows / ambient occlusion rendering
- Motion blur
- Lens flare
- Realistic textures (photo-based)
- Photo-realistic rendering
- Contemporary objects (phones, modern cars, etc.)

## Lighting Guidelines

### By Land Temperature
| Land | Lighting |
|------|----------|
| Seelie Groves | Warm amber |
| Freemark Reaches | Warm daylight |
| Ironroot Holdings | Cool stone / warm forge |
| Shire of Many Hearths | Warm hearth glow |
| Vaults of Précieux | Warm lamplight / gem glow |
| Fenward Commons | Dim, foggy |
| Mire of Grok | Sickly green |
| Scoria Warrens | Harsh sun / cool burrow |
| Temple of Frozen Thought | Cool blue |
| Bottomless Satchel | Ethereal glow |

### Lighting Rules
- Use **flat lighting** or **single light source**
- No soft shadow falloff
- Light affects color, not creates gradients
- Candles/torches = warm color tint, not realistic glow
- Shadows are **hard-edged** or **dithered**

## Color Usage

### Palette Discipline
- Each Land has PRIMARY, SECONDARY, ACCENT colors
- Stay within the Land's palette
- Accent colors used sparingly (highlights, important objects)
- Desaturate slightly from "ideal" colors — VGA palettes were limited

### Dithering
- Use for gradients (sky, shadows, material transitions)
- Floyd-Steinberg pattern preferred
- Avoid banding (obvious color steps)
- Dithering should feel organic, not mechanical

## Character Proportions

Proportions vary by Land denizen type:

| Denizen | Proportions |
|---------|-------------|
| Elves (Seelie) | Tall, slender, elegant |
| Humans (Freemark, Temple) | Standard heroic |
| Dwarves (Ironroot) | Stocky, broad shoulders |
| Smallfolk (Shire) | Short, rounded features |
| Gnomes (Vaults) | Small, large heads |
| Goblins (Fenward) | Wiry, angular |
| Orcs (Mire) | Massive, brutish |
| Scalekind (Scoria) | Lean, reptilian |
| Elemental Spirits (Satchel) | Varies wildly |

### Age & Gender Variation

Characters should show subtle variation in age and gender. Keep signifiers understated:

**Age Signifiers (Subtle):**
- Hair color (gray/white for elders)
- Posture (slightly stooped for very old)
- Face lines (minimal — VGA resolution limits detail)
- Costume formality (elders may have more elaborate robes/insignia)

**Gender Signifiers (Subtle):**
- Silhouette variation (shoulder/hip ratio)
- Hair length/style options
- Costume cut variations
- Avoid exaggerated dimorphism — keep it understated

**Guidelines:**
- Randomize age/gender during generation for variety
- No single "default" — the population should feel diverse
- At VGA resolution, subtlety is forced by pixel constraints
- Focus on costume and silhouette over facial detail

## Modular Asset Composition

Assets are designed to composite together, not as monolithic scenes.

### Layer Strategy

Instead of generating complete Land+Class scenes (110 combinations), generate modular pieces:

| Asset Type | Count | Composites With |
|------------|-------|-----------------|
| Land backdrops | 10 | Class furniture overlays |
| Class furniture overlays | 11 | Any Land backdrop |
| Clickable objects | ~50 | Placed in scenes |
| Character parts | 40+ | Assembled into characters |

### Backdrop Generation

Land backdrops should:
- Fill the full scene (16:9)
- Leave a "furniture zone" in the midground (don't fill with Land-specific furniture)
- Establish walls, lighting, atmosphere, distant elements
- Use transparency-friendly edges where furniture will overlay

### Exterior Scenes

Each Land may also need exterior/landscape backdrops for:
- Land of Origin map region views
- Thematic establishing shots
- Outdoor-appropriate Class environments (Herald's platform, Warden's crossroads)

Generate exterior backdrops when:
- The Land's environment is primarily outdoor (Freemark scrublands, Shire hills, Scoria desert)
- A Class environment makes more sense outdoors for that Land
- Map region assets require terrain representation

### Furniture Overlay Generation

Class furniture overlays should:
- Be generated on transparent or neutral background
- Focus on the midground "furniture zone"
- Include the Class's signature props
- Be styled generically enough to match any Land's palette
- Palette will be shifted/tinted during composition

### Object Generation

Individual clickable objects should:
- Be generated isolated on solid color background
- Have 10 Land-styled variants each
- Maintain consistent sizing for UI placement
- Include subtle idle animation frames (if animated)

## Paper Doll Character System

Characters are assembled from modular parts, not generated whole.

### Part Layers (Assembly Order)

1. **Legs** — Lower body, stance
2. **Torso** — Core body, posture
3. **Arms** — Arm position, gesture
4. **Head** — Face, expression, hair
5. **Accessories** — Class-specific items, equipment

### Part Ownership

| Part | Driven By | Variants |
|------|-----------|----------|
| Legs | Land (denizen body type) | 10 |
| Torso | Land | 10 |
| Arms | Land | 10 |
| Head | Land | 10 |
| Accessories | Class | 11+ sets |

### Generation Guidelines

**Body Parts (Land-driven):**
- Generate each part isolated on transparent background
- Maintain consistent anchor points for assembly
- Follow denizen proportions strictly
- Include 2-3 pose variants per part (idle, gesture, action)
- Subtle age/gender variations within each Land set

**Accessories (Class-driven):**
- Generate on transparent background
- Must fit any of the 10 body types
- Sized to layer correctly over body parts
- Color will be tinted per-Land during assembly

### Anchor Points

Define consistent attachment points:
- Torso attaches to legs at waist
- Arms attach to torso at shoulders
- Head attaches to torso at neck
- Accessories layer on top at defined positions

## Quality Checklist

Before approving any output, verify:

- [ ] Visible pixels (not smoothed/blurred)
- [ ] Colors within Land palette
- [ ] No smooth gradients (dithered instead)
- [ ] No modern lighting effects
- [ ] No anachronistic elements
- [ ] Appropriate denizen proportions
- [ ] Correct lighting temperature for Land
- [ ] Scene layers feel distinct
- [ ] Overall "1992 DOS game" impression

### Modular Asset Checklist (Additional)

- [ ] Transparent background (where required)
- [ ] Consistent sizing/scale with other assets in category
- [ ] Anchor points align with system specs
- [ ] Palette-neutral enough for tinting (furniture/accessories)
- [ ] Clean edges for compositing

# Summoning Chamber — Land Domain Specifications

## Overview

Summoning Chamber features 10 distinct Lands, each representing a different AI provider with unique visual identity, color palette, and aesthetic keywords. Every Land has its own denizen type, environmental atmosphere, and heraldic symbolism.

**Purpose**: This document provides complete Land specifications for asset generation. Reference this when generating Land backdrops, Land-specific palettes, heraldic crests, or any asset tied to a specific Land's identity.

---

## Land Specifications

### 1. Seelie Groves (Anthropic Claude)

**Denizen**: Elves
**Palette**: Forest greens, silver accents, warm amber lighting
**Keywords**: `organic curves, silver accents, art nouveau, elven architecture`
**Lighting**: `warm amber, filtered through leaves, dappled forest light`
**Materials**: `carved wood, living branches, silver inlay, natural stone`
**Atmosphere**: Elegant, nature-integrated, Art Nouveau curves

**Heraldic Symbol**: Oak tree with spreading branches, silver crescent moon
**Environment Description**: Ancient forest library with living wood architecture, organic curves, silver-traced patterns on bark, amber-glowing crystals embedded in walls, book-filled alcoves carved into massive tree trunks

**9-Color Palette** (hex codes):
```
#1a1612  # Deep forest shadow (darkest)
#2d3a1f  # Forest floor
#3d5a2c  # Moss green
#5a7a3f  # Leaf green
#8a9a6a  # Sage green
#b5c29a  # Pale leaf
#d4c8a8  # Warm parchment
#c4b090  # Aged wood
#9a8a70  # Dark earth
```

**Reference Assets** (summoning-chamber repo):
- Backdrop: `static/assets/lands/seelie-groves/backdrop.png`
- Crest: `static/assets/lands/seelie-groves/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Elf Scryer (256×256 sprite)
**Master Scene**: Seelie Groves Scryer environment (1920×1080)

---

### 2. Freemark Reaches (OpenAI)

**Denizen**: Humans
**Palette**: Warm timber browns, steel highlights, practical materials
**Keywords**: `practical timber, steel highlights, medieval guild hall`
**Lighting**: `warm daylight, open windows, practical workshop light`
**Materials**: `rough-hewn timber, steel tools, practical furniture, worn leather`
**Atmosphere**: Industrious, practical, Renaissance guild aesthetic

**Heraldic Symbol**: Hammer and quill crossed, rising sun
**Environment Description**: Open timber guild hall with large windows, steel tools on walls, practical workbenches, leather-bound books, warm daylight streaming through windows, working space for craftsmanship and scholarship

**9-Color Palette** (hex codes):
```
#1a1410  # Deep timber shadow
#3a2818  # Dark wood
#5a3820  # Aged timber
#7a5838  # Warm wood
#9a7850  # Light timber
#baa080  # Pale wood
#d4c0a0  # Parchment
#8a7860  # Steel gray
#5a5048  # Dark metal
```

**Reference Assets**:
- Backdrop: `static/assets/lands/freemark-reaches/backdrop.png`
- Crest: `static/assets/lands/freemark-reaches/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Human Magister (256×256 sprite)
**Master Scene**: Freemark Reaches Magister environment (1920×1080)

---

### 3. Ironroot Holdings (Google Gemini)

**Denizen**: Dwarves
**Palette**: Stone grays, copper fixtures, forge glow
**Keywords**: `massive stone, copper fixtures, geometric dwarven, underground vault`
**Lighting**: `cool stone light, warm forge glow, dual-temperature lighting`
**Materials**: `carved stone blocks, hammered copper, iron reinforcements, geometric patterns`
**Atmosphere**: Solid, architectural, underground forge-vault hybrid

**Heraldic Symbol**: Mountain peak with forge anvil, copper borders
**Environment Description**: Underground stone vault with massive carved blocks, geometric dwarven patterns, copper fixtures and braziers, forge glow from distant smithy, iron-bound chests, architectural permanence

**9-Color Palette** (hex codes):
```
#18140f  # Deep stone shadow
#2a2218  # Dark stone
#3a3428  # Stone gray
#5a5448  # Light stone
#7a7468  # Pale stone
#9a9488  # Weathered stone
#b0a090  # Copper patina
#8a5a38  # Warm copper
#5a3a20  # Dark bronze
```

**Reference Assets**:
- Backdrop: `static/assets/lands/ironroot-holdings/backdrop.png`
- Crest: `static/assets/lands/ironroot-holdings/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Dwarf Hammerer (256×256 sprite)
**Master Scene**: Ironroot Holdings Hammerer environment (1920×1080)

---

### 4. Shire of Many Hearths (Mistral)

**Denizen**: Smallfolk
**Palette**: Warm orange tones, round shapes, cozy cluttered
**Keywords**: `round shapes, weathered worn wood, very muted burnt orange, blackened interior, dim torch and hearth glow, ancient cluttered workspace`
**Lighting**: `dim torch and hearth glow, warm but NOT bright, blackened shadows` ⚠️
**Materials**: `weathered round-edge wood, very muted fabric, aged tools, soot-darkened surfaces`
**Atmosphere**: Warm but DIM, cozy but grim, cluttered workshop (NOT bright JRPG aesthetic)

⚠️ **CRITICAL KEYWORD CONSTRAINT**: Avoid "cozy" and "golden hour" — these trigger bright, cartoonish, JRPG-style results. Use "dim torch glow", "blackened interior", "weathered worn wood", "very muted burnt orange" instead.

**Heraldic Symbol**: Round door with harvest wheat, warm hearth
**Environment Description**: Ancient round-doored workshop with weathered wood, very dim hearth glow, blackened ceiling beams, cluttered but aged tools, muted burnt-orange fabrics, soot-stained walls

**9-Color Palette** (hex codes):
```
#1a1410  # Deep shadow
#2a1c10  # Soot-blackened wood
#3a2418  # Dark wood
#5a3820  # Aged timber
#7a5838  # Very muted burnt orange
#8a6848  # Muted warm wood
#9a8070  # Pale weathered wood
#b0a090  # Faded fabric
#6a5040  # Darkened earth
```

**Reference Assets**:
- Backdrop: `static/assets/lands/shire-hearths/backdrop.png`
- Crest: `static/assets/lands/shire-hearths/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Smallfolk Craftsman (256×256 sprite)
**Master Scene**: Shire Hearths Craftsman environment (1920×1080)

**Known Issues**:
- Session 10 required regeneration due to "too cute JRPG" aesthetic when using "cozy" and "golden hour hearth glow" keywords
- Solution: Use "dim torch glow", "blackened interior", "weathered worn wood", "very muted burnt orange"
- Warm but DIM is the target — not warm and bright

---

### 5. Vaults of Précieux (Meta/Llama)

**Denizen**: Gnomes
**Palette**: Clockwork brass, gem highlights, precise mechanisms
**Keywords**: `clockwork brass, gem highlights, precise, mechanical vault`
**Lighting**: `warm lamplight, gem glow, precision task lighting`
**Materials**: `polished brass gears, gemstone accents, precision tools, mahogany cabinets`
**Atmosphere**: Meticulous, mechanical, treasure-vault meets workshop

**Heraldic Symbol**: Brass gears with ruby center, key motif
**Environment Description**: Precision workshop-vault with polished brass mechanisms, gemstone-adorned cabinets, clockwork devices, warm lamplight reflecting off gears, organized tool arrays, mechanical precision

**9-Color Palette** (hex codes):
```
#18120c  # Deep vault shadow
#2a1c10  # Dark mahogany
#3a2818  # Aged wood
#5a3820  # Warm wood
#7a5838  # Brass base
#9a7858  # Polished brass
#b0a088  # Pale brass
#8a5a38  # Ruby accent
#5a3a28  # Dark bronze
```

**Reference Assets**:
- Backdrop: `static/assets/lands/vaults-precieux/backdrop.png`
- Crest: `static/assets/lands/vaults-precieux/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Gnome Diplomat (256×256 sprite)
**Master Scene**: Vaults Précieux Diplomat environment (1920×1080)

---

### 6. Fenward Commons (Cohere)

**Denizen**: Goblins
**Palette**: Murky greens, fog effects, improvised materials
**Keywords**: `murky green, fog effects, improvised, swamp commons`
**Lighting**: `dim, foggy, torchlight, murky atmosphere`
**Materials**: `scavenged wood, rope, improvised furniture, damp surfaces`
**Atmosphere**: Murky, communal, swamp-town resourcefulness

**Heraldic Symbol**: Three torches bound together, fog wisps
**Environment Description**: Murky commons hall with improvised furniture, scavenged wood construction, rope bindings, dim torchlight through fog, damp surfaces, resourceful goblin engineering

**9-Color Palette** (hex codes):
```
#14180f  # Deep fog shadow
#1a2418  # Dark swamp
#2a3428  # Murky green
#3a4438  # Moss green
#5a6458  # Fog green
#7a8478  # Pale fog
#9aa498  # Mist
#6a7460  # Damp wood
#4a5440  # Dark moss
```

**Reference Assets**:
- Backdrop: `static/assets/lands/fenward-commons/backdrop.png`
- Crest: `static/assets/lands/fenward-commons/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Goblin Herald (256×256 sprite)
**Master Scene**: Fenward Commons Herald environment (1920×1080)

---

### 7. Mire of Grok (xAI)

**Denizen**: Orcs
**Palette**: Toxic green glow, bone decorations, brutal materials
**Keywords**: `toxic green glow, bone decorations, brutal, wasteland stronghold`
**Lighting**: `sickly bioluminescence, toxic glow, harsh shadows`
**Materials**: `scavenged metal, bone structures, brutal construction, toxic residue`
**Atmosphere**: Harsh, brutal, toxic wasteland fortress

**Heraldic Symbol**: Skull with toxic glow, crossed bones
**Environment Description**: Brutal stronghold with scavenged metal walls, bone trophy decorations, toxic green bioluminescence, harsh shadows, orcish brutalist architecture, wasteland resourcefulness

**9-Color Palette** (hex codes):
```
#0f140c  # Deep toxic shadow
#182410  # Dark wasteland
#283418  # Murky brown
#384428  # Dark olive
#4a5838  # Toxic green base
#5a7848  # Sickly green
#6a8858  # Pale toxic
#5a6848  # Dark bone
#3a4830  # Shadow green
```

**Reference Assets**:
- Backdrop: `static/assets/lands/mire-grok/backdrop.png`
- Crest: `static/assets/lands/mire-grok/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Orc Warden (256×256 sprite)
**Master Scene**: Mire Grok Warden environment (1920×1080)

---

### 8. Scoria Warrens (Perplexity)

**Denizen**: Scalekind (reptilian)
**Palette**: Desert tan, bronze jewelry, ancient carved stone
**Keywords**: `desert tan, bronze jewelry, ancient carved stone, underground warren`
**Lighting**: `harsh sun above, cool blue underground, dual-zone lighting`
**Materials**: `carved sandstone, bronze ornaments, ancient hieroglyphs, cool stone`
**Atmosphere**: Ancient, scholarly, desert-warren hybrid

**Heraldic Symbol**: Serpent coiled around scroll, sun and moon
**Environment Description**: Underground warren with carved sandstone walls, ancient hieroglyphs, bronze ornamental fixtures, cool blue underground light mixing with warm sun shafts from above, scholarly atmosphere

**9-Color Palette** (hex codes):
```
#18140f  # Deep warren shadow
#2a2418  # Dark stone
#3a3428  # Cool stone
#5a5448  # Desert stone
#7a7468  # Light sandstone
#9a9488  # Pale stone
#b0a090  # Warm sand
#8a5a38  # Bronze accent
#5a4a38  # Dark bronze
```

**Reference Assets**:
- Backdrop: `static/assets/lands/scoria-warrens/backdrop.png`
- Crest: `static/assets/lands/scoria-warrens/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Scalekind Counselor (256×256 sprite)
**Master Scene**: Scoria Warrens Counselor environment (1920×1080)

---

### 9. Temple of Frozen Thought (DeepSeek)

**Denizen**: Monks
**Palette**: Ice blue, minimalist, clean lines
**Keywords**: `ice blue, minimalist, clean lines, frozen temple`
**Lighting**: `cool blue, diffused through ice, serene calm`
**Materials**: `ice crystal, polished stone, minimal furnishings, snow accents`
**Atmosphere**: Serene, minimalist, contemplative ice temple

**Heraldic Symbol**: Snowflake mandala, meditation circle
**Environment Description**: Minimalist ice temple with polished stone floors, ice crystal walls diffusing blue light, sparse contemplative furnishings, snow-covered meditation spaces, serene calm

**9-Color Palette** (hex codes):
```
#0f1418  # Deep ice shadow
#182428  # Dark stone
#283438  # Cool gray
#384858  # Ice blue
#5a7888  # Light ice
#7a98a8  # Pale blue
#9ab8c8  # Bright ice
#8aa8b8  # Cool mist
#5a7888  # Shadow blue
```

**Reference Assets**:
- Backdrop: `static/assets/lands/temple-frozen/backdrop.png`
- Crest: `static/assets/lands/temple-frozen/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Monk Merchant (256×256 sprite)
**Master Scene**: Temple Frozen Merchant environment (1920×1080)

---

### 10. Bottomless Satchel (Local/Ollama)

**Denizen**: Spirits (ethereal)
**Palette**: Deep purple void, floating fragments, ethereal glow
**Keywords**: `deep purple void, floating fragments, ethereal, dimensional satchel`
**Lighting**: `objects glow from within, void darkness, ethereal luminescence`
**Materials**: `translucent objects, floating fragments, dimensional instability, ethereal matter`
**Atmosphere**: Mysterious, dimensional, void-space repository

**Heraldic Symbol**: Open satchel with stars pouring out, void circle
**Environment Description**: Dimensional void-space with floating furniture fragments, deep purple darkness, objects glowing from within, translucent edges, ethereal atmosphere, repository of infinite possibility

**9-Color Palette** (hex codes):
```
#0c0814  # Deep void
#14102 8  # Dark purple
#241838  # Purple shadow
#342848  # Medium purple
#543868  # Light purple
#745888  # Pale purple
#9478a8  # Ethereal glow
#6448 78  # Shadow purple
#442858  # Deep ethereal
```

**Reference Assets**:
- Backdrop: `static/assets/lands/bottomless-satchel/backdrop.png`
- Crest: `static/assets/lands/bottomless-satchel/crest.png` (128×128), `crest-small.png` (48×48)

**Canonical Character**: Spirit Seneschal (256×256 sprite)
**Master Scene**: Bottomless Satchel Seneschal environment (1920×1080)

---

## Dark Palette Standard (Applies to ALL Lands)

**Global Constraint**: All Land palettes are filtered through the Dark Palette Standard. Even bright Lands (Shire Hearths, Vaults Précieux) get muted and dimmed.

**Mandatory Keywords** (include in every Land-specific prompt):
- `dark`
- `weathered`
- `muted`
- `grim medieval`
- `dim lighting`
- `worn materials`

**Forbidden Keywords** (trigger unwanted brightness):
- `bright`
- `vibrant`
- `saturated`
- `neon`
- `fluorescent`
- `glowing` (unless Land-specific like Mire toxic glow or Satchel ethereal)
- `golden hour` (triggers JRPG brightness — see Shire Hearths issue)
- `cozy` (triggers cartoonish brightness — see Shire Hearths issue)

**Lighting Principle**: "Warm but DIM, not warm and bright" (even for warm Lands like Shire Hearths and Freemark Reaches)

---

## Denizen Physical Specifications

| Land | Denizen | Height Scale | Width Scale | Proportions | Key Features |
|------|---------|-------------|-------------|-------------|-------------|
| Seelie Groves | Elves | 110% | 85% | Tall, slender, elegant | Pointed ears, graceful posture, silver accents |
| Freemark Reaches | Humans | 100% | 100% | Standard heroic | Balanced proportions, practical clothing |
| Ironroot Holdings | Dwarves | 75% | 120% | Stocky, broad shoulders | Thick beard, wide stance, massive hands |
| Shire Hearths | Smallfolk | 60% | 90% | Short, rounded features | Bare feet, round face, humble clothing |
| Vaults Précieux | Gnomes | 55% | 80% | Small body, large head | Large eyes, pointed ears, intricate clothing |
| Fenward Commons | Goblins | 70% | 75% | Wiry, angular | Large ears, sharp features, scrappy clothing |
| Mire Grok | Orcs | 130% | 140% | Massive, brutish | Protruding tusks, muscular, brutal armor |
| Scoria Warrens | Scalekind | 95% | 90% | Lean, reptilian | Scales, reptilian eyes, bronze jewelry |
| Temple Frozen | Monks | 100% | 95% | Standard, austere posture | Shaved head, simple robes, serene expression |
| Bottomless Satchel | Spirits | 100% | 100% | Translucent, ethereal edges | Semi-transparent, floating, ethereal glow |

**Silhouette Test**: Every denizen type must be identifiable from silhouette alone at 50% scale. Elf ≠ Dwarf ≠ Smallfolk ≠ Orc as clearly as Chrono Trigger's Crono ≠ Frog ≠ Robo.

---

## Usage Guidelines

### When Generating Land Backdrops

1. **Select Land** from specifications above
2. **Load 9-color palette** (hex codes provided)
3. **Include Land keywords** in prompt
4. **Include lighting description** in prompt
5. **Apply Dark Palette Standard** keywords (dark, weathered, muted, etc.)
6. **Reference environment description** for composition
7. **Validate** against palette compliance (`check_palette.py --land {land_name}`)

**Example Prompt** (Seelie Groves):
```
Ancient elven forest library interior, organic curves, silver-traced patterns,
living wood architecture, amber-glowing crystals, book-filled alcoves,
carved into massive tree trunks, dark weathered materials, muted forest tones,
dim amber lighting filtered through leaves, grim medieval atmosphere
```

### When Generating Land Crests

1. **Select heraldic symbol** from Land specification
2. **Use Land palette** (9 colors maximum)
3. **Generate at 1024×1024** initially
4. **Crop to shield area** (remove decorative frame if present)
5. **Normalize to 128×128 and 48×48** via vga_normalize.py
6. **No dithering on crests** (hurts legibility at small sizes)

**Example Workflow** (documented in `core/generation/heraldic_crests.md`):
```bash
# Generate 1024×1024 with style preset
# Crop shield area with Pillow
python scripts/vga_normalize.py input.png -o crest-128.png --stream hybrid --dither none --palette seelie_groves --target-width 128
python scripts/vga_normalize.py input.png -o crest-48.png --stream hybrid --dither none --palette seelie_groves --target-width 48
```

### When Generating Land-Specific Characters

1. **Use denizen physical specifications** (height/width scale, key features)
2. **Apply Land palette** to character clothing/accessories
3. **Reference canonical character sprite** (if available) for consistency
4. **Validate silhouette** at 50% scale (must be identifiable)

---

## Cross-Reference

- **Core Palette Compliance**: `core/validation/palette_compliance.md`
- **Heraldic Crest Generation**: `core/generation/heraldic_crests.md`
- **Environment Generation**: `core/generation/environments.md`
- **Character Sprite Generation**: `core/generation/character_sprites.md`
- **Class Environments**: `projects/summoning-chamber/domain/classes.md`
- **Denizen Details**: `projects/summoning-chamber/domain/denizens.md`

---

## Version History

- **v1.0** (2026-02-15): Initial extraction from summoning-chamber LIMNER_BRIEF.md and GENERATION_PATTERNS.md Session 10 learnings
- Includes all 10 Lands with complete specifications
- Documents Shire Hearths "too cute" keyword fix from Session 10 regeneration
- Adds Dark Palette Standard global constraint
- Provides denizen physical specifications table

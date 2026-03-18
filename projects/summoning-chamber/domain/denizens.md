# Summoning Chamber — Denizen Domain Specifications

## Overview

Summoning Chamber features 10 distinct Denizen types, each associated with a specific Land and representing unique physical characteristics, cultural aesthetics, and AI provider personality. Denizens are not composited from parts — they are generated as complete character sprites with Land-specific palettes and visual consistency maintained via reference images.

**Purpose**: This document provides complete Denizen specifications for character sprite generation. Reference this when generating Tier 1 canonical characters, Tier 2 class variants, or any character-based assets.

---

## Denizen Physical Specifications

| Denizen | Land | Height | Width | Proportions | Silhouette Key Features |
|---------|------|--------|-------|-------------|------------------------|
| Elves | Seelie Groves | 110% | 85% | Tall, slender, elegant | Pointed ears, graceful vertical posture, narrow shoulders |
| Humans | Freemark Reaches | 100% | 100% | Standard heroic | Balanced proportions, practical stance, medium build |
| Dwarves | Ironroot Holdings | 75% | 120% | Stocky, broad | Wide shoulders, short legs, barrel chest, thick limbs |
| Smallfolk | Shire Hearths | 60% | 90% | Short, rounded | Round face, bare feet, soft edges, childlike proportions |
| Gnomes | Vaults Précieux | 55% | 80% | Small body, large head | Large eyes, pointed ears, oversized head ratio, delicate limbs |
| Goblins | Fenward Commons | 70% | 75% | Wiry, angular | Large pointed ears, sharp features, lean build, angular joints |
| Orcs | Mire Grok | 130% | 140% | Massive, brutish | Protruding tusks, hunched powerful shoulders, thick neck, heavy brow |
| Scalekind | Scoria Warrens | 95% | 90% | Lean, reptilian | Scales texture, reptilian eyes, tail silhouette, sleek build |
| Monks | Temple Frozen | 100% | 95% | Standard, austere | Shaved head, simple robes, upright posture, serene stance |
| Spirits | Bottomless Satchel | 100% | 100% | Translucent, ethereal | Semi-transparent edges, floating posture, ethereal glow, no solid feet |

---

## Detailed Denizen Specifications

### 1. Elves (Seelie Groves)

**Associated Land**: Seelie Groves
**Associated AI Provider**: Anthropic Claude
**Visual Theme**: Art Nouveau elegance, forest nobility

**Physical Characteristics**:
- **Height**: 110% of human baseline (tall and elegant)
- **Width**: 85% of human baseline (slender, graceful)
- **Posture**: Vertical, graceful, refined stance
- **Distinguishing Features**:
  - Pointed ears (prominent, upward-swept)
  - Narrow shoulders
  - Long elegant limbs
  - Refined facial features (high cheekbones, almond eyes)
  - Flowing hair (silver, blonde, or dark with silver highlights)

**Clothing Aesthetic**:
- Natural fabrics (silk, linen) in forest tones
- Silver or white metal accents (not gold)
- Organic Art Nouveau patterns
- Flowing robes or tunics
- Nature-inspired jewelry (leaves, branches, crystals)

**Palette** (from Seelie Groves):
- Deep forest greens
- Silver accents
- Warm amber highlights
- Muted earth tones for clothing
- No bright or saturated colors (Dark Palette Standard applies)

**Canonical Character**: Elf Scryer (Tier 1)
**Reference Sprite**: `static/assets/characters/elf/elf-scryer.png` (256×256)

**Silhouette Test**: Tall vertical form with pointed ear peaks, graceful proportions, distinct from stocky Dwarf or massive Orc

---

### 2. Humans (Freemark Reaches)

**Associated Land**: Freemark Reaches
**Associated AI Provider**: OpenAI
**Visual Theme**: Practical Renaissance, guild professionalism

**Physical Characteristics**:
- **Height**: 100% baseline (standard heroic proportions)
- **Width**: 100% baseline (balanced build)
- **Posture**: Upright, confident, practical
- **Distinguishing Features**:
  - Balanced facial features
  - Medium build (neither slender nor stocky)
  - Practical hairstyles (tied back for work, short, functional)
  - Capable hands (visible tool-use)
  - Grounded stance (feet planted)

**Clothing Aesthetic**:
- Practical work clothing (tunics, breeches, vests)
- Leather aprons or tool belts (class-dependent)
- Steel or iron accents (buckles, buttons)
- Warm earth tones (browns, tans, dark reds)
- Functional over decorative

**Palette** (from Freemark Reaches):
- Warm timber browns
- Steel grays
- Dark reds and ochres
- Leather browns
- Muted practical colors

**Canonical Character**: Human Magister (Tier 1)
**Reference Sprite**: `static/assets/characters/human/human-magister.png` (256×256)

**Silhouette Test**: Standard balanced proportions, distinct from tall Elf or short Smallfolk, practical stance

---

### 3. Dwarves (Ironroot Holdings)

**Associated Land**: Ironroot Holdings
**Associated AI Provider**: Google Gemini
**Visual Theme**: Underground forge, geometric stonework

**Physical Characteristics**:
- **Height**: 75% of human baseline (short and stocky)
- **Width**: 120% of human baseline (broad, powerful)
- **Posture**: Wide stance, low center of gravity, solid
- **Distinguishing Features**:
  - Thick full beard (prominent, well-kept or wild)
  - Broad shoulders and barrel chest
  - Short powerful legs
  - Thick muscular arms
  - Heavy brow and strong jaw
  - Often helmeted or bare-headed (no hood)

**Clothing Aesthetic**:
- Heavy leather and metal armor elements
- Geometric patterns (dwarven craft motifs)
- Copper or iron fixtures
- Practical work clothing under armor
- Tool belts or smith aprons (class-dependent)
- Boots (heavy, reinforced)

**Palette** (from Ironroot Holdings):
- Stone grays
- Copper and bronze accents
- Iron blacks
- Dark earth tones
- Forge glow highlights (used sparingly)

**Canonical Character**: Dwarf Hammerer (Tier 1)
**Reference Sprite**: `static/assets/characters/dwarf/dwarf-hammerer.png` (256×256)

**Silhouette Test**: Wide stocky form with prominent beard, distinct from tall Elf or lean Goblin, low solid stance

---

### 4. Smallfolk (Shire of Many Hearths)

**Associated Land**: Shire of Many Hearths
**Associated AI Provider**: Mistral
**Visual Theme**: Humble craftsfolk, warm but dim hearth culture

**Physical Characteristics**:
- **Height**: 60% of human baseline (short, childlike)
- **Width**: 90% of human baseline (soft rounded proportions)
- **Posture**: Comfortable, approachable, grounded
- **Distinguishing Features**:
  - Round friendly face
  - Soft body proportions (not angular)
  - Bare feet (prominent, large for body size)
  - Curly or tousled hair
  - Cheerful or content expression
  - Childlike proportions (large head relative to body)

**Clothing Aesthetic**:
- Simple homespun fabrics
- Very muted warm tones (burnt orange, weathered browns)
- Comfortable loose-fitting clothing
- Practical aprons or vests
- No shoes (bare feet visible)
- Buttons, patches, humble details

**Palette** (from Shire Hearths):
- Very muted burnt orange
- Weathered browns
- Blackened shadows (dim environment)
- Aged fabric colors
- NO bright cheerful colors (Dark Palette Standard CRITICAL)

⚠️ **CRITICAL**: Avoid bright JRPG-style rendering. Smallfolk should be warm but DIM, grim medieval, NOT cartoonish or cute. See Session 10 Shire regeneration for keyword fixes.

**Canonical Character**: Smallfolk Craftsman (Tier 1)
**Reference Sprite**: `static/assets/characters/smallfolk/smallfolk-craftsman.png` (256×256)

**Silhouette Test**: Short round form with bare feet visible, distinct from angular Goblin or tall Human, soft edges

---

### 5. Gnomes (Vaults of Précieux)

**Associated Land**: Vaults of Précieux
**Associated AI Provider**: Meta/Llama
**Visual Theme**: Precision mechanics, gemstone accents

**Physical Characteristics**:
- **Height**: 55% of human baseline (very small)
- **Width**: 80% of human baseline (delicate build)
- **Posture**: Upright, meticulous, precise movements
- **Distinguishing Features**:
  - Large head relative to body (biggest head ratio)
  - Large expressive eyes
  - Pointed ears (elf-like but smaller)
  - Delicate hands (visible fine-motor capability)
  - Thin limbs
  - Often wearing magnifying lenses or precision tools

**Clothing Aesthetic**:
- Precision work clothing (tailored, fitted)
- Brass buttons and gear decorations
- Gemstone accents (small, tasteful)
- Pockets and tool loops (organized)
- Polished leather boots (small, well-made)
- Colors coordinated with mechanical aesthetic

**Palette** (from Vaults Précieux):
- Brass and bronze tones
- Gemstone highlights (ruby, sapphire — muted)
- Dark mahogany browns
- Polished metal colors
- Rich but muted fabric tones

**Canonical Character**: Gnome Diplomat (Tier 1)
**Reference Sprite**: `static/assets/characters/gnome/gnome-diplomat.png` (256×256)

**Silhouette Test**: Very small with oversized head, large eyes visible, distinct from stocky Dwarf or rounded Smallfolk, delicate proportions

---

### 6. Goblins (Fenward Commons)

**Associated Land**: Fenward Commons
**Associated AI Provider**: Cohere
**Visual Theme**: Scrappy resourcefulness, swamp commons

**Physical Characteristics**:
- **Height**: 70% of human baseline (short but wiry)
- **Width**: 75% of human baseline (lean, angular)
- **Posture**: Hunched or crouched, alert stance
- **Distinguishing Features**:
  - Large pointed ears (bat-like, expressive)
  - Sharp angular features (pointed chin, nose)
  - Wiry build (lean muscle, visible joints)
  - Long fingers (dexterous)
  - Sharp teeth (visible when grinning)
  - Alert eyes (large, yellow or green)

**Clothing Aesthetic**:
- Scavenged and improvised clothing
- Rope bindings and rough stitching
- Murky green and brown tones
- Patched fabrics
- Bare feet or crude wrappings
- Functional over aesthetic (tools, pouches)

**Palette** (from Fenward Commons):
- Murky greens
- Swamp browns
- Fog grays
- Damp wood tones
- Minimal color variety (muted palette)

**Canonical Character**: Goblin Herald (Tier 1)
**Reference Sprite**: `static/assets/characters/goblin/goblin-herald.png` (256×256)

**Silhouette Test**: Wiry angular form with large pointed ears, hunched posture, distinct from rounded Smallfolk or massive Orc, sharp edges

---

### 7. Orcs (Mire of Grok)

**Associated Land**: Mire of Grok
**Associated AI Provider**: xAI
**Visual Theme**: Brutal strength, wasteland fortress

**Physical Characteristics**:
- **Height**: 130% of human baseline (massive, towering)
- **Width**: 140% of human baseline (incredibly broad)
- **Posture**: Hunched powerful shoulders, intimidating presence
- **Distinguishing Features**:
  - Protruding tusks (lower jaw, prominent)
  - Thick neck and heavy brow
  - Massive muscular build
  - Large hands (can grip large weapons)
  - Scarred skin (visible battle damage)
  - Brutal facial features (heavy jaw, small eyes)

**Clothing Aesthetic**:
- Heavy armor (scavenged metal, brutal construction)
- Bone decorations (trophies, intimidation)
- Crude but effective equipment
- Toxic green accents (Mire aesthetic)
- Leather straps and metal plates
- Brutalist functionality

**Palette** (from Mire Grok):
- Toxic green accents
- Dark wasteland browns
- Scavenged metal grays
- Bone whites (weathered)
- Shadow greens and blacks

**Canonical Character**: Orc Warden (Tier 1)
**Reference Sprite**: `static/assets/characters/orc/orc-warden.png` (256×256)

**Silhouette Test**: Massive towering form with tusks visible, hunched powerful shoulders, distinct from ALL other denizens by sheer size and bulk

---

### 8. Scalekind (Scoria Warrens)

**Associated Land**: Scoria Warrens
**Associated AI Provider**: Perplexity
**Visual Theme**: Ancient scholarly reptilian, desert warren

**Physical Characteristics**:
- **Height**: 95% of human baseline (slightly shorter)
- **Width**: 90% of human baseline (lean, sleek)
- **Posture**: Upright, scholarly, serpentine grace
- **Distinguishing Features**:
  - Reptilian scales (visible texture)
  - Reptilian eyes (slitted pupils, golden or amber)
  - Tail (long, balanced, visible in silhouette)
  - Clawed hands (delicate but visible)
  - Sleek build (no bulk)
  - Possible crest or frills (head/neck decoration)

**Clothing Aesthetic**:
- Bronze jewelry (armbands, necklaces, earrings)
- Light flowing robes (desert-appropriate)
- Ancient hieroglyphic patterns
- Sandstone and bronze color coordination
- Minimal coverage (scales visible)
- Scholarly accessories (scroll cases, amulets)

**Palette** (from Scoria Warrens):
- Desert sandstone tans
- Bronze accents
- Cool underground blues
- Scale greens or browns
- Ancient stone grays

**Canonical Character**: Scalekind Counselor (Tier 1)
**Reference Sprite**: `static/assets/characters/scalekind/scalekind-counselor.png` (256×256)

**Silhouette Test**: Lean reptilian form with tail visible, scaled texture, distinct from smooth-skinned denizens, sleek vertical posture

---

### 9. Monks (Temple of Frozen Thought)

**Associated Land**: Temple of Frozen Thought
**Associated AI Provider**: DeepSeek
**Visual Theme**: Minimalist contemplation, ice temple serenity

**Physical Characteristics**:
- **Height**: 100% of human baseline (standard)
- **Width**: 95% of human baseline (slightly lean from contemplative lifestyle)
- **Posture**: Perfectly upright, serene, balanced stance
- **Distinguishing Features**:
  - Shaved head (or very short hair)
  - Serene calm expression
  - Simple robes (no adornment)
  - Bare feet or simple sandals
  - Minimalist appearance
  - Meditative hand positions

**Clothing Aesthetic**:
- Simple robes (single-color, unadorned)
- Ice blue or cool gray tones
- Minimal fabric (not heavy)
- Rope belt or cord tie
- No jewelry or decoration
- Functional purity

**Palette** (from Temple Frozen):
- Ice blues
- Cool grays
- Pale whites
- Minimalist color range
- Serene cool tones

**Canonical Character**: Monk Merchant (Tier 1)
**Reference Sprite**: `static/assets/characters/monk/monk-merchant.png` (256×256)

**Silhouette Test**: Standard human proportions with shaved head, simple robes, upright serene posture, distinct from decorated denizens by minimalism

---

### 10. Spirits (Bottomless Satchel)

**Associated Land**: Bottomless Satchel
**Associated AI Provider**: Local/Ollama
**Visual Theme**: Ethereal void-space entities, dimensional instability

**Physical Characteristics**:
- **Height**: 100% of human baseline (variable but standard)
- **Width**: 100% of human baseline (translucent, appears standard)
- **Posture**: Floating, no ground contact, ethereal grace
- **Distinguishing Features**:
  - Semi-transparent body (edges fade to translucent)
  - Ethereal glow from within
  - No solid feet (floating, hovering)
  - Flowing form (clothing and body blend)
  - Possible wisps or trails (ethereal effects)
  - Void-purple hues in translucency

**Clothing Aesthetic**:
- Flowing robes or garments (blend with body)
- Deep purple void tones
- Ethereal glow highlights
- Translucent fabrics
- No solid accessories (all ethereal)
- Dimensional instability (edges flicker or fade)

**Palette** (from Bottomless Satchel):
- Deep purple void
- Ethereal glow highlights
- Translucent edges
- Void blacks
- Inner luminescence

**Canonical Character**: Spirit Seneschal (Tier 1)
**Reference Sprite**: `static/assets/characters/spirit/spirit-seneschal.png` (256×256)

**Silhouette Test**: Translucent form with no feet visible, floating posture, ethereal glow, distinct from ALL solid-bodied denizens by transparency

---

## Character Sprite Generation Guidelines

### Tier 1: Canonical Characters (MVP — 10 sprites)

**Purpose**: Establish visual identity for each Land with one representative character

**Approach**:
1. One character per Land
2. Each a different Class (10 Lands × 1 Class each = 10 sprites)
3. Denizen matches Land association
4. Generated at 256×256 full sprite (not paperdoll parts)
5. Becomes reference image for Tier 2 variants

**Tier 1 List**:
| Land | Denizen | Class | Sprite File |
|------|---------|-------|-------------|
| Seelie Groves | Elf | Scryer | `elf-scryer.png` |
| Freemark Reaches | Human | Magister | `human-magister.png` |
| Ironroot Holdings | Dwarf | Hammerer | `dwarf-hammerer.png` |
| Shire Hearths | Smallfolk | Craftsman | `smallfolk-craftsman.png` |
| Vaults Précieux | Gnome | Diplomat | `gnome-diplomat.png` |
| Fenward Commons | Goblin | Herald | `goblin-herald.png` |
| Mire Grok | Orc | Warden | `orc-warden.png` |
| Scoria Warrens | Scalekind | Counselor | `scalekind-counselor.png` |
| Temple Frozen | Monk | Merchant | `monk-merchant.png` |
| Bottomless Satchel | Spirit | Seneschal | `spirit-seneschal.png` |

### Tier 2: Class Variants (Phase 1 Extension — 20-30 sprites)

**Purpose**: Cover popular class combinations for high-traffic use cases

**Approach**:
1. Use Tier 1 canonical sprite as reference image
2. Generate same denizen in different class environment
3. Maintain facial features, body proportions, color palette from Tier 1
4. Only clothing and equipment change to reflect new class

**Example**: Elf Scryer (Tier 1) → Elf Magister (Tier 2)
- Reference image: `elf-scryer.png`
- Maintain: Pointed ears, slender build, silver accents, graceful posture
- Change: Scryer robes → Magister scholar robes, scrying tools → books

### Tier 3: Full Matrix (Post-Launch — up to 110 sprites)

**Purpose**: Complete coverage of all denizen/class combinations

**Scope**: 10 denizens × 11 classes = 110 total possible combinations

**Approach**: Same as Tier 2 (reference image consistency), but comprehensive

---

## Reference Image Consistency Strategy

Retro Diffusion API supports up to 9 reference images per generation. Use this to maintain denizen appearance across class variants:

**Workflow**:
1. Generate Tier 1 canonical sprite (e.g., Elf Scryer)
2. User approves and sprite becomes "reference sprite" for that denizen
3. When generating Tier 2 variant (e.g., Elf Magister):
   - Load Elf Scryer as reference image #1
   - Load Magister class overlay as reference image #2 (furniture context)
   - Generate with prompt emphasizing class-specific clothing/equipment
4. Result: Same elf face, proportions, palette — different class outfit

**Key Parameters**:
```json
{
  "prompt": "Elf character in Magister scholar robes, holding book, [description]",
  "reference_images": [
    "base64_encoded_elf_scryer_sprite",
    "base64_encoded_magister_overlay"
  ],
  "style": "rd_pro__default",
  "width": 256,
  "height": 256,
  "remove_bg": true,
  "input_palette": "base64_encoded_seelie_groves_palette"
}
```

---

## Silhouette Quality Gate

**Requirement**: Every denizen type must be identifiable from silhouette alone at 50% scale.

**Test Method**:
1. Convert sprite to pure black silhouette
2. Scale down to 128×128 (50% of 256×256)
3. Display silhouettes side-by-side for all 10 denizens
4. Verify each is uniquely identifiable without color or detail

**Pass Criteria**:
- Elf ≠ Dwarf ≠ Smallfolk ≠ Orc clearly distinguishable
- Height/width proportions alone should identify denizen
- Key features visible in silhouette (ears, beard, tail, tusks, etc.)

**Reference Standard**: Chrono Trigger character silhouettes
- Crono ≠ Frog ≠ Robo ≠ Ayla clearly distinct at small scale
- Summoning Chamber denizens should achieve same clarity

---

## Pose and Framing Guidelines

**Standard Character Pose** (for all sprites):
- Front-facing or 3/4 view (not profile)
- Standing upright (denizen-appropriate posture)
- Hands visible (class-appropriate tool or gesture)
- Feet visible (or floating for Spirits)
- Centered in frame
- Clear space around character (not cropped tight)

**Class-Specific Poses**:
- **Scryer**: Holding crystal or mirror, contemplative hand position
- **Magister**: Holding book or quill, scholarly stance
- **Hammerer**: Holding hammer or tool, work-ready posture
- **Craftsman**: Holding crafting tool, focused expression
- **Diplomat**: Open welcoming gesture, standing or seated
- **Herald**: Holding horn or scroll, alert posture
- **Warden**: Hand on weapon, protective stance
- **Counselor**: Calm seated or standing, hands in wisdom gesture
- **Merchant**: Holding scales or ledger, transactional posture
- **Seneschal**: Organizing gesture, command presence
- **Bard**: Holding instrument, performance-ready

---

## Prompt Structure for Character Sprites

**Template**:
```
[DENIZEN TYPE] [CLASS] character, [key physical features],
[class-specific equipment], [denizen-specific clothing aesthetic],
front-facing, clear silhouette, distinct color regions,
dark fantasy medieval, worn equipment,
[Land palette keywords if applicable]
```

**Example** (Elf Scryer):
```
Elf Scryer character, tall slender build, pointed ears, silver accents,
holding crystal ball, flowing dark robes with silver trim,
graceful posture, front-facing, clear silhouette,
dark fantasy medieval, Art Nouveau details,
forest greens and silver palette
```

**Critical Parameters**:
- `remove_bg: true` (transparent background)
- `style: "rd_pro__default"` (clean character style)
- `width: 256, height: 256` (standard sprite size)
- `input_palette: [Land palette]` (enforce Land colors)
- `reference_images: [...]` (for Tier 2+ consistency)

---

## Cross-Reference

- **Land Palettes**: `projects/summoning-chamber/domain/lands.md`
- **Class Environments**: `projects/summoning-chamber/domain/classes.md`
- **Character Generation Workflow**: `core/generation/character_sprites.md`
- **Reference Image Strategy**: `core/generation/reference_image_consistency.md`
- **Silhouette Validation**: `core/validation/silhouette_quality.md`
- **Master Scene Composition**: `core/generation/letterboxing.md`

---

## Version History

- **v1.0** (2026-02-15): Initial extraction from summoning-chamber LIMNER_BRIEF.md and character specifications
- Includes all 10 Denizen types with complete physical characteristics
- Documents Tier 1/2/3 generation strategy
- Documents reference image consistency approach
- Provides silhouette quality gate requirements
- Includes pose and framing guidelines per class

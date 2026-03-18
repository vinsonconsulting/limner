# Reference Images — Character Consistency via RD API

## Overview

The Retro Diffusion API's `reference_images` parameter enables visual consistency across multiple generations by using approved assets as compositional guides. This capability is critical for maintaining character appearance, style coherence, and architectural consistency throughout a project.

**Key Advantage**: Lock denizen/character appearance across class variants, equipment changes, and pose variations without regenerating from scratch each time.

## Reference Image Fundamentals

### Parameter Specification

**API Parameter**: `reference_images` (array of base64-encoded images)
**Availability**: RD_PRO tier only (not available in RD_PLUS or RD_FAST)
**Capacity**: Up to 9 reference images per generation
**Format**: Base64-encoded PNG or JPEG
**Resolution Requirement**: Minimum 256px on smallest dimension

### How Reference Images Work

**Reference images guide composition and style rather than direct pixel copying**:

1. **Compositional Influence** — Layout, pose, proportions, relative positioning
2. **Style Transfer** — Color harmony, line weight, shading approach, detail level
3. **Feature Preservation** — Facial features, body proportions, characteristic elements
4. **Palette Continuity** — Color usage patterns from reference inform new generation

**Important**: Reference images are **guides**, not templates. RD interprets and adapts references to fit the new prompt while maintaining visual consistency.

## Primary Use Case: Character Consistency

### Tiered Character Generation Strategy

Generating a full character matrix (e.g., 10 denizen types × 11 character classes = 110 total sprites) requires strategic sequencing to maintain visual coherence:

| Tier | Scope | Count | Purpose | Cost Estimate |
|------|-------|-------|---------|---------------|
| **Tier 1 (Canonical)** | One character per denizen type | 10 sprites | Establish denizen visual identity | ~$2.20 (10 × $0.22) |
| **Tier 2 (Variants)** | Popular class combinations for high-traffic denizens | 20-30 sprites | Expand coverage with consistency | ~$4.40-$6.60 |
| **Tier 3 (Full Matrix)** | All denizen × class combinations | 110 sprites | Complete coverage | ~$24.20 total |

**Strategy**: Generate Tier 1 canonicals first → use approved canonicals as references for all subsequent variants.

### Tier 1: Canonical Character Generation

**Goal**: Establish the definitive visual appearance for each denizen type.

**Workflow**:

1. **Select Canonical Pairing** — Choose one class per denizen that best represents core identity
   - Example: Elf → Scryer (magical, scholarly aesthetic)
   - Example: Dwarf → Hammerer (craftsmanship, strength)
   - Example: Orc → Warden (brutish, martial)

2. **Generate Without References** — First canonical generation has no references (bootstrap)
   ```json
   {
     "width": 256,
     "height": 256,
     "prompt": "elf scryer character, tall slender proportions, elegant features, scholarly robes, front-facing pose, clear silhouette, dark fantasy pixel art",
     "prompt_style": "rd_pro__default",
     "num_images": 2,
     "remove_bg": true,
     "input_palette": "base64_encoded_land_palette"
   }
   ```

3. **User Approval** — Review variations, select best canonical
4. **Save as Reference** — Approved canonical becomes reference for all Elf variants

### Tier 2 & 3: Variant Generation with References

**Goal**: Generate class variants for the same denizen while maintaining core appearance.

**Workflow**:

1. **Encode Reference** — Convert approved canonical to base64
   ```python
   import base64
   from PIL import Image
   import io

   def encode_reference(image_path):
       img = Image.open(image_path)
       buffer = io.BytesIO()
       img.save(buffer, format='PNG')
       return base64.b64encode(buffer.getvalue()).decode()

   elf_scryer_ref = encode_reference('static/assets/characters/elf/elf-scryer.png')
   ```

2. **Generate Variant with Reference**
   ```json
   {
     "width": 256,
     "height": 256,
     "prompt": "elf hammerer character, tall slender proportions, elegant features, blacksmith leather apron and tools, front-facing pose, clear silhouette, dark fantasy pixel art",
     "prompt_style": "rd_pro__default",
     "num_images": 2,
     "remove_bg": true,
     "reference_images": ["<elf_scryer_base64>"],
     "input_palette": "base64_encoded_land_palette"
   }
   ```

3. **Validation** — Verify facial features, body proportions, color palette match canonical
4. **Iterate if Needed** — If drift detected, regenerate with stronger reference influence

### What References Preserve vs. What Can Change

**Preserved from Reference** (inherited across variants):
- Facial structure (eyes, nose, mouth proportions)
- Body proportions (height, build, limb length)
- Skin tone and color palette harmony
- Line weight and shading approach
- Overall character style (realistic vs stylized, detail level)

**Adapted per Prompt** (variant-specific):
- Clothing and equipment (class-specific gear)
- Pose and stance (within same body proportions)
- Accessories and props
- Expression (within same facial structure)

## Character Specification Parameters

### Denizen Proportions (Example Matrix)

When prompting variants with references, emphasize preserved proportions:

| Denizen | Height Scale | Width Scale | Key Features | Reference Prompt Keywords |
|---------|--------------|-------------|--------------|---------------------------|
| Elf | 110% | 85% | Tall, slender, elegant | "tall slender proportions, elegant features" |
| Human | 100% | 100% | Standard heroic | "standard heroic proportions, balanced build" |
| Dwarf | 75% | 120% | Stocky, broad shoulders | "short stocky build, broad shoulders" |
| Smallfolk | 60% | 90% | Short, rounded | "short rounded proportions, small stature" |
| Gnome | 55% | 80% | Small body, large head | "small body, proportionally large head" |
| Goblin | 70% | 75% | Wiry, angular | "wiry angular build, lean frame" |
| Orc | 130% | 140% | Massive, brutish | "massive brutish proportions, hulking build" |
| Scalekind | 95% | 90% | Lean, reptilian | "lean reptilian build, scaled features" |
| Monk | 100% | 95% | Standard, austere | "balanced proportions, austere posture" |
| Spirit | 100% | 100% | Translucent, ethereal | "ethereal proportions, translucent edges" |

**Usage**: Include proportion keywords in prompts for variants to reinforce reference guidance.

### Multi-Reference Strategies

RD_PRO supports up to 9 references — use multiple references for complex consistency:

**Example: Class-Specific Equipment Set**

Generate 3 equipment pieces for Scryer class → use all 3 as references when generating Scryer variants for other denizens:

```json
{
  "prompt": "orc scryer character, massive brutish proportions, scholarly robes and equipment, scrying implements, front-facing pose",
  "reference_images": [
    "<elf_scryer_canonical_base64>",  // Preserve Scryer aesthetic
    "<scrying_mirror_base64>",        // Equipment consistency
    "<scholar_robes_base64>"          // Clothing style
  ]
}
```

**Result**: Orc body proportions + Scryer class aesthetic + consistent equipment across all Scryer variants.

## Secondary Use Cases

### Furniture Arrangement Consistency

**Scenario**: Generate furniture sets across different Lands with consistent layout.

**Workflow**:
1. Generate canonical furniture arrangement for one Land
2. Use approved arrangement as reference for other Lands
3. Result: Same spatial composition, different palette and material textures

**Example**:
```json
{
  "prompt": "desert carved stone furniture, meditation cushions and tea table, ancient bronze decorations, dark fantasy",
  "reference_images": ["<approved_furniture_layout_base64>"],
  "input_palette": "scoria_warrens_palette"
}
```

### Architectural Style Transfer

**Scenario**: Maintain architectural style (Art Nouveau, Brutalist, etc.) across multiple environment assets.

**Workflow**:
1. Generate hero environment piece establishing architectural language
2. Use as reference for additional environment assets
3. Result: Coherent architectural style throughout environment set

### Equipment Set Consistency

**Scenario**: Generate multi-piece equipment sets (sword + shield + helm) with visual coherence.

**Workflow**:
1. Generate first equipment piece (e.g., ornate sword)
2. Use as reference for complementary pieces
3. Result: Visually unified equipment set (matching decorative motifs, color scheme, detail level)

## Reference Image Best Practices

### Preparation

**Resolution Requirements**:
- Minimum: 256px on smallest dimension
- Recommended: Match target generation resolution (e.g., 256×256 for sprites)
- Avoid: Low-resolution references cause detail loss in guidance

**Encoding**:
```python
def prepare_references(image_paths):
    """Encode multiple images as base64 for RD API."""
    references = []
    for path in image_paths:
        img = Image.open(path)

        # Verify minimum resolution
        if min(img.size) < 256:
            raise ValueError(f"{path}: Minimum dimension {min(img.size)}px < 256px required")

        # Encode
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        references.append(base64.b64encode(buffer.getvalue()).decode())

    return references
```

### Selection Strategy

**Which Assets to Use as References**:

✅ **Good Reference Candidates**:
- User-approved assets (passed quality gates)
- Canonical/hero assets establishing visual identity
- Assets with clear, readable features at target resolution
- Assets with appropriate detail level for target use case

❌ **Poor Reference Candidates**:
- Rejected/failed generations
- Assets with visual defects (mixels, smooth gradients, anti-aliasing)
- Over-detailed assets for simpler target generation
- Assets from different aesthetic styles

### Validation: References Guide, Not Copy

**Quality Gate**: Generated variants should maintain consistency **without** being pixel-perfect copies.

**Validation Checklist**:
- [ ] Core features preserved (facial structure, proportions, style)
- [ ] Prompt adaptations applied (class-specific gear, pose, expression)
- [ ] No direct pixel copying (variants are new generations, not edits)
- [ ] Visual family resemblance clear at 50% scale
- [ ] Color palette harmony maintained

**Example Test**: Display canonical + 3 variants side-by-side at 50% scale → all should be recognizable as same denizen type with class-specific differences evident.

## Common Reference Usage Patterns

### Pattern 1: Single Canonical Reference

**Use Case**: Generate all class variants for one denizen type
**References**: 1 (approved canonical character)
**Result**: All variants share denizen appearance, differ by class equipment/pose

```json
{
  "reference_images": ["<elf_scryer_canonical>"]
}
```

### Pattern 2: Multi-Reference Style Transfer

**Use Case**: Apply established aesthetic to new subject
**References**: 2-3 (approved assets defining target style)
**Result**: New subject rendered in consistent style

```json
{
  "reference_images": [
    "<style_example_1>",
    "<style_example_2>",
    "<color_palette_example>"
  ]
}
```

### Pattern 3: Compositional Template

**Use Case**: Maintain layout/composition across variations
**References**: 1 (approved composition/layout)
**Result**: Same spatial arrangement, different content/palette

```json
{
  "reference_images": ["<approved_layout_template>"]
}
```

### Pattern 4: Equipment Set Coherence

**Use Case**: Generate complementary equipment pieces
**References**: 1-2 (first pieces in set)
**Result**: Visually unified equipment set

```json
{
  "reference_images": [
    "<ornate_sword>",
    "<matching_shield>"
  ]
}
```

## Troubleshooting Reference Influence

### Issue: Reference Too Weak (Variants Drifting)

**Symptoms**: Generated variants don't match canonical appearance, features inconsistent

**Solutions**:
1. **Strengthen Prompt** — Explicitly describe preserved features ("tall slender proportions like reference")
2. **Add More References** — Use 2-3 canonical examples instead of 1
3. **Reduce Prompt Complexity** — Simpler prompts let references dominate
4. **Check Reference Resolution** — Low-res references provide weak guidance

### Issue: Reference Too Strong (Copying Instead of Guiding)

**Symptoms**: Variants are near-pixel-copies, prompt changes ignored

**Solutions**:
1. **Reduce Reference Count** — Use 1 reference instead of multiple
2. **Increase Prompt Detail** — More specific prompts override reference copying
3. **Use `bypass_prompt_expansion: false`** — Let RD expand prompt for more variation
4. **Check Reference Similarity** — Multiple similar references reinforce copying

### Issue: Reference Conflicts (Multiple Incompatible References)

**Symptoms**: Generated asset has confused composition, mixed styles, visual artifacts

**Solutions**:
1. **Reduce Reference Count** — Fewer references = clearer guidance
2. **Use Coherent Reference Set** — All references should share aesthetic/style
3. **Prioritize One Reference** — Place most important reference first in array
4. **Test References Individually** — Isolate which reference causes conflict

## Cost Optimization with References

### Efficiency Gains

**Tier 1 Canonical Generation**: 10 characters × 2 variations × $0.22 = ~$4.40
**Tier 2 Variants (with references)**: 20 characters × 2 variations × $0.22 = ~$8.80
**Total Tier 1+2**: ~$13.20 for 30 consistent characters

**Without References** (regenerating from scratch each time):
- Higher rejection rate (inconsistent denizen appearance)
- More iterations per character (~3-4 attempts vs 1-2 with references)
- Estimated cost: 30 characters × 3 attempts × $0.22 = ~$19.80

**Savings**: ~33% cost reduction via reference reuse

### Reference Reuse Across Sessions

**Strategy**: Save approved canonicals as permanent reference library

**Directory Structure**:
```
references/
├── characters/
│   ├── elf-canonical.png
│   ├── dwarf-canonical.png
│   └── orc-canonical.png
├── furniture/
│   ├── layout-template-1.png
│   └── layout-template-2.png
└── equipment/
    ├── ornate-sword.png
    └── scholar-robes.png
```

**Workflow**:
1. Generate Tier 1 canonicals → save approved to `references/characters/`
2. All future character generations reference this library
3. No need to regenerate canonicals → direct cost savings + consistency guarantee

## Integration with Other Parameters

### References + Input Palette

**Combination**: Reference images guide composition/style, `input_palette` enforces color compliance

```json
{
  "reference_images": ["<elf_scryer_canonical>"],
  "input_palette": "base64_encoded_seelie_groves_palette"
}
```

**Result**: Elf appearance consistent with reference + colors match Land palette

**Use Case**: Generate denizen variants across different Lands — preserve denizen identity while adapting to Land color schemes.

### References + Seed

**Combination**: Reference images + fixed seed = reproducible variations

```json
{
  "reference_images": ["<canonical>"],
  "seed": 42
}
```

**Use Case**: Reproduce exact generation result for variant tweaking or A/B testing.

### References + Remove Background

**Combination**: Reference images for character consistency + `remove_bg: true` for clean sprites

```json
{
  "reference_images": ["<character_canonical>"],
  "remove_bg": true
}
```

**Use Case**: Character sprite generation with transparent backgrounds — maintain denizen appearance across all class variants.

## Validation Workflow

### Post-Generation Reference Consistency Check

**Checklist**:

1. **Visual Comparison** — Display canonical + variant side-by-side at 100% and 50% scale
   - [ ] Same facial structure (eyes, nose, mouth proportions match)
   - [ ] Same body proportions (height/width scale matches denizen spec)
   - [ ] Same color harmony (palette usage consistent)
   - [ ] Same line weight and shading approach

2. **Prompt Adaptation Check** — Verify class-specific elements applied
   - [ ] Clothing matches class description (robes vs armor vs apron)
   - [ ] Equipment appropriate to class (scrying mirror vs hammer vs sword)
   - [ ] Pose fits class archetype (scholarly stance vs battle-ready)

3. **Silhouette Test** — Denizen type recognizable from silhouette alone
   - [ ] Elf ≠ Dwarf ≠ Orc as distinct silhouettes at 50% scale
   - [ ] Class-specific equipment visible but denizen identity dominant

4. **Family Resemblance Test** — All variants for same denizen look related
   - [ ] Display 3-5 class variants for same denizen together
   - [ ] Family resemblance clear (facial features consistent)
   - [ ] Diversity clear (class differences evident)

**Pass/Fail Threshold**: If 2+ checklist items fail, regenerate with adjusted reference influence.

## Summary: Reference Images Decision Tree

```
┌─────────────────────────────────────┐
│ Need visual consistency across     │
│ multiple generations?               │
└─────────────┬───────────────────────┘
              │
              ├─ YES ─→ Using RD_PRO tier?
              │         │
              │         ├─ YES ─→ Have approved canonical/reference?
              │         │         │
              │         │         ├─ YES ─→ Encode as base64 ─→ Use reference_images parameter
              │         │         │
              │         │         └─ NO ─→ Generate canonical first ─→ Save approved ─→ Use for future variants
              │         │
              │         └─ NO (RD_PLUS/FAST) ─→ Cannot use references ─→ Rely on prompt consistency only
              │
              └─ NO ─→ Skip references ─→ Generate from prompt alone
```

## Key Takeaways

1. **Reference images are guides, not templates** — RD adapts references to fit prompt while maintaining visual consistency
2. **RD_PRO tier only** — Reference images unavailable in RD_PLUS or RD_FAST
3. **Up to 9 references per generation** — Use multiple references for complex consistency requirements
4. **Minimum 256px resolution** — Low-res references provide weak guidance
5. **Tiered generation strategy** — Generate canonicals first → use as references for all variants (33% cost savings)
6. **Validation required** — Check that references guide without copying, prompt changes applied
7. **Combine with other parameters** — Reference images + input_palette + remove_bg = consistent denizen across Lands with clean sprites
8. **Build reference library** — Save approved canonicals for reuse across sessions and projects

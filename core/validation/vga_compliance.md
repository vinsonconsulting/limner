# VGA Compliance — Quality Gates

> Reusable validation framework for VGA-era pixel art aesthetic (1990-1993)

## Overview

VGA compliance ensures pixel art matches the authentic look and technical constraints of VGA-era DOS games. These quality gates apply regardless of your specific project or artistic theme.

## Hard Requirements

### 1. Hard Pixel Edges (No Anti-Aliasing)

**Rule**: Every pixel must be fully opaque or fully transparent — no intermediate alpha values on edges.

**Why**: VGA hardware couldn't render smooth transitions. Anti-aliased edges create "mixels" that break the pixel grid aesthetic.

**Validation**:
```python
# Check for anti-aliasing on transparency edges
# Any pixel with alpha between 1-254 indicates anti-aliasing
```

**Common Failures**:
- Modern diffusion models default to smooth edges
- Upscaling with bilinear/bicubic filters introduces anti-aliasing
- Export settings that enable "smooth edges" or "optimize for web"

**Fix**:
- Generate at target resolution (no downsampling)
- Use nearest-neighbor scaling only
- Check export settings for anti-aliasing toggles

### 2. Dithering Appropriate to Asset Type

**Rule**: Atmospheric backgrounds use Floyd-Steinberg dithering for gradients. Clean sprites use flat shading or minimal dithering.

**Why**: VGA palettes couldn't represent smooth gradients. Dithering creates the illusion of more colors through pixel patterns.

**Dithering Strategy**:
- **Backgrounds/Environments**: Floyd-Steinberg dithering for atmospheric depth
- **Character Sprites**: No dithering (flat color regions, clear silhouettes)
- **Props/Equipment**: Minimal dithering (only where material texture requires it)
- **UI Elements**: No dithering (crisp, readable)

**Common Failures**:
- Dithering on character sprites (reduces silhouette clarity)
- No dithering on gradients (creates banding/posterization)
- Wrong dithering algorithm (ordered dithering looks checkered, not VGA)

### 3. No Smooth Gradients

**Rule**: Gradients must be dithered or stepped (flat color bands), never smoothly blended.

**Why**: VGA couldn't render smooth color transitions. Visible color steps are authentic.

**Acceptable Approaches**:
- Floyd-Steinberg dithered gradients (atmospheric)
- Stepped gradients with visible bands (3-5 color levels)
- Flat shading with no gradients (clean sprites)

**Forbidden**:
- Smooth linear gradients (RGB 0→255 continuous)
- Gaussian/airbrush effects
- Volumetric lighting with soft falloff

### 4. Flat Lighting (No Modern Effects)

**Rule**: Lighting must be simple and direct — single light source, hard shadows, no ambient occlusion.

**Why**: VGA games had limited rendering. Modern lighting techniques (GI, AO, ray tracing) didn't exist.

**Acceptable Lighting**:
- Single directional light source (sun, torch, candle)
- Hard-edged shadows (no penumbra)
- Simple specular highlights (single bright pixel or small cluster)

**Forbidden**:
- Ambient occlusion (soft shadowing in crevices)
- Global illumination (bounced light, color bleeding)
- Volumetric effects (god rays, fog with light scattering)
- Lens flare, bloom, HDR

### 5. 256-Color Maximum Per Palette

**Rule**: Each asset uses at most 256 distinct colors, preferably far fewer (9-16 for themed palettes).

**Why**: VGA mode 13h supported 256 colors on screen simultaneously. Themed palettes (Land-specific, class-specific) are even more constrained.

**Validation**:
```bash
# Count unique colors in image
python scripts/count_colors.py path/to/asset.png
# Should return ≤256 colors
```

**Common Failures**:
- RGB/RGBA mode with thousands of near-identical colors
- Gradients that introduce subtle color variations
- Anti-aliasing edge pixels creating intermediate colors

**Fix**:
- Convert to indexed color mode (palette mode)
- Use palette quantization with your target palette
- Check color count before and after generation

### 6. Silhouette Readable at 50% Scale

**Rule**: Character sprites and important props must be recognizable from silhouette alone when scaled to 50%.

**Why**: VGA games were often played on small monitors. Critical gameplay elements needed instant recognizability.

**Validation**:
- Scale asset to 50% using nearest-neighbor
- Fill with solid black
- Ask: "Can I identify what this is?"

**Common Failures**:
- Excessive detail that becomes noise when scaled
- Weak pose/stance that doesn't communicate character
- Thin appendages that disappear at small sizes

**Fix**:
- Prioritize strong silhouettes over internal detail
- Use clear, exaggerated poses
- Ensure limbs/features have minimum 3-4px width

## Quality Checklist

Use this checklist for every asset before approval:

- [ ] Hard pixel edges (no anti-aliasing) — Edges are crisp, no fuzzy transitions
- [ ] Appropriate dithering — Backgrounds dithered, sprites flat
- [ ] No smooth gradients — All gradients either dithered or stepped
- [ ] Flat lighting — Simple directional light, hard shadows
- [ ] ≤256 colors — Count verified, palette compliant
- [ ] Silhouette test passed — Recognizable at 50% scale (sprites only)
- [ ] No forbidden elements — No modern lighting, bloom, soft shadows, etc.
- [ ] Overall "1992 DOS game" impression — Looks authentic, not modern indie pixel art

## Validation Tools

### Automated Validation

```bash
# VGA compliance check (palette, edges, gradients)
python scripts/validate_asset.py path/to/asset.png

# Batch validate directory
python scripts/validate_asset.py --batch path/to/directory/
```

### Manual Validation

1. **Zoom to 400-800%** — Verify pixel grid alignment, hard edges
2. **Check transparency edges** — No semi-transparent fringe
3. **Silhouette test** — Scale to 50%, fill black, check recognizability
4. **Color count** — Verify ≤256 unique colors
5. **Side-by-side reference** — Compare to authentic VGA game screenshots

## Common Failure Patterns

### Pattern: "Modern Indie Pixel Art"

**Symptoms**:
- Smooth gradients with perfect color blending
- Soft shadows and ambient occlusion
- Anti-aliased edges for "polish"
- Neon/saturated color palettes

**Diagnosis**: Tool defaulting to modern pixel art aesthetic

**Fix**:
- Enforce palette constraints at generation time
- Use VGA-specific style presets if available
- Add explicit negative prompts: "no smooth gradients, no modern lighting"

### Pattern: "Over-Dithered Sprites"

**Symptoms**:
- Character sprites with heavy dithering
- Noisy, unclear silhouettes
- Difficulty reading small details

**Diagnosis**: Wrong dithering strategy for asset type

**Fix**:
- Disable dithering for clean sprites
- Reserve dithering for atmospheric backgrounds only
- Use flat shading on characters

### Pattern: "Palette Explosion"

**Symptoms**:
- Color count exceeds 256
- Subtle color variations that aren't visually distinct
- Anti-aliasing creating intermediate colors

**Diagnosis**: RGB mode without palette quantization

**Fix**:
- Convert to indexed color mode
- Apply palette quantization during generation
- Remove anti-aliasing before color counting

## Style Preset Mapping (Retro Diffusion Example)

Different generation tools have different ways to enforce VGA compliance. Example from Retro Diffusion API:

| Asset Type | VGA Strategy | Style Preset |
|------------|-------------|--------------|
| Backgrounds | Heavy dithering, atmospheric depth | `rd_pro__fantasy` + dark palette |
| Characters | No dithering, flat shading, clear silhouettes | `rd_pro__default` + `remove_bg` |
| Props | Minimal dithering, material texture | `rd_pro__simple` |
| UI | No dithering, crisp edges | `rd_fast__ui` |

Adapt this mapping to your generation tool's capabilities.

## Integration with Other Validations

VGA compliance is one layer. Your project may also need:
- **Palette compliance** — Colors match specific themed palette (e.g., Land-specific colors)
- **Color mode compliance** — Indexed color storage for file size optimization
- **Asset spec compliance** — Correct dimensions, file format, naming convention

VGA compliance focuses on aesthetic authenticity. Other validations handle technical/organizational requirements.

---

*This document is framework-agnostic. Adapt validation commands and style presets to your specific generation pipeline.*

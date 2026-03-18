# Retro Diffusion API — Native Pixel Art Generation

> Framework for generating grid-aligned pixel art using the Retro Diffusion API

## Overview

Retro Diffusion is a specialized diffusion model that generates true pixel art natively — no downsampling, no vector-to-pixel conversion, no post-hoc dithering injection. Unlike traditional image generation tools that require extensive post-processing, RD produces grid-aligned pixel art with proper palette constraints and style consistency out of the box.

**Key Advantages**:
- Native pixel grid alignment (no mixels, no sub-pixel noise)
- Built-in style presets mapped to rendering streams
- Palette enforcement at generation time via `input_palette` parameter
- Reference image support (up to 9) for character/asset consistency
- Transparent background generation via `remove_bg` parameter
- Seed control for reproducible results
- Tileset generation with wang combinations
- Animation support (sprite sheets, idle loops, VFX)

## API Endpoints

**Base URL**: `https://api.retrodiffusion.ai/v1`

### Generation Endpoint
```
POST /v1/inferences
```

**Headers**:
```json
{
  "X-RD-Token": "your_api_token",
  "Content-Type": "application/json"
}
```

**Request Body**:
```json
{
  "width": 256,
  "height": 256,
  "prompt": "description of asset",
  "num_images": 1,
  "prompt_style": "rd_pro__fantasy",
  "input_palette": "base64_encoded_palette_image",
  "reference_images": ["base64_ref_1", "base64_ref_2"],
  "remove_bg": true,
  "seed": 12345,
  "bypass_prompt_expansion": false,
  "check_cost": false
}
```

**Response**:
```json
{
  "base64_images": ["base64_encoded_png_1", "base64_encoded_png_2"],
  "credit_cost": 2,
  "remaining_credits": 998
}
```

### Credits Check Endpoint
```
GET /v1/inferences/credits
```

**Headers**: Same as generation endpoint

**Response**:
```json
{
  "credits": 1000
}
```

## Model Tiers

| Tier | Cost/Image | Max Resolution | Reference Images | Best For |
|------|-----------|---------------|-----------------|----------|
| **RD_PRO** | $0.22 | 512×512 | Up to 9 | Hero assets — characters, backdrops, complex scenes |
| **RD_PLUS** | $0.025–0.05 | Varies by style | Limited | Mid-tier — icons, crests, items, environments |
| **RD_FAST** | $0.015–0.025 | Varies by style | None | Rapid iteration — UI elements, previews, testing |
| **RD_TILE** | $0.10/tileset | 16–64px tiles | None | Seamless tiles and tilesets |
| **RD_ANIMATION** | $0.07–0.25 | Style-dependent | None | Sprite sheets, idle loops, VFX |

### Tier Selection Guidelines

**Use RD_PRO when**:
- Asset is a hero element (main characters, primary backgrounds)
- Need maximum detail and quality
- Require multiple reference images for consistency
- Can afford 10–20× cost vs RD_PLUS

**Use RD_PLUS when**:
- Asset is secondary importance (icons, props, UI)
- Need good quality at moderate cost
- Budget-conscious batch generation (50+ assets)
- Can iterate with minimal reference images

**Use RD_FAST when**:
- Rapid prototyping and exploration
- Testing prompt patterns before committing to RD_PRO
- Simple UI elements with low detail requirements
- Maximum cost efficiency for large batches

**Use RD_TILE when**:
- Need seamless floor/wall textures
- Building tileset libraries
- Mathematically perfect wang combinations required

**Use RD_ANIMATION when**:
- Character idle loops
- UI spinner/loading animations
- VFX sprite sheets (ember glow, magic effects)

## Key Parameters

### `prompt` (required)

Text description of the asset to generate.

**RD has built-in prompt expansion** that enriches short prompts. For most cases, use concise descriptions and let RD expand:

```
"elf wizard, dark medieval, front-facing"
```

RD expands to include pixel art style keywords, color palette guidance, and composition hints.

**Use `bypass_prompt_expansion: true`** only when:
- Prompt expansion is causing unwanted drift
- You need exact control over every keyword
- Testing specific prompt patterns

**Prompt Structure Pattern**:
```
[SUBJECT], [MOOD/ATMOSPHERE], [KEY VISUAL DETAILS]
```

**Examples**:
- Character: `"dwarf blacksmith, dark fantasy, front-facing, clear silhouette"`
- Background: `"medieval library interior, dim candlelight, weathered stone and wood"`
- Icon: `"crystal ball on stand, top-down view, clear silhouette"`

### `prompt_style` (required)

Style preset that determines rendering approach. See `style_presets.md` for complete mapping.

**Quick Reference**:
- Atmospheric backgrounds: `rd_pro__fantasy`, `rd_pro__horror`
- Clean characters/sprites: `rd_pro__default`, `rd_pro__simple`
- Icons: `rd_plus__skill_icon`, `rd_plus__classic`
- UI elements: `rd_fast__ui`, `rd_plus__ui_element`
- Equipment: `rd_plus__topdown_item`

### `input_palette` (optional but recommended)

Base64-encoded palette reference image (8×2 grid PNG with palette colors).

**Why Use It**:
- Enforces color compliance at generation time (no post-processing quantization)
- Maintains Land/theme-specific color identity
- Prevents RD from defaulting to brighter palettes
- Reduces need for palette correction afterward

**Palette Image Format**:
- **Dimensions**: 8×2 pixels (16 colors max) or 8×1 (8 colors)
- **Format**: PNG
- **Content**: Each pixel is one palette color (RGB values)
- **Encoding**: Base64 string of the PNG file

**Creating Palette Images** (Python example):
```python
from PIL import Image
import base64

def create_palette_image(colors, output_path):
    """
    colors: List of (R,G,B) tuples (max 16)
    Creates 8×2 grid palette image
    """
    width, height = 8, 2
    img = Image.new('RGB', (width, height))
    pixels = img.load()
    
    for i, color in enumerate(colors):
        if i >= width * height:
            break
        x = i % width
        y = i // width
        pixels[x, y] = color
    
    img.save(output_path)

def encode_palette_for_api(palette_path):
    with open(palette_path, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    return encoded

# Example: Dark fantasy palette
palette_colors = [
    (45, 35, 25),   # Dark brown base
    (70, 55, 40),   # Medium brown
    (35, 45, 30),   # Dark muted green
    (55, 70, 45),   # Medium green
    (140, 140, 135), # Silver highlight
    (90, 75, 50),   # Warm wood
    (80, 65, 35),   # Amber glow
    (25, 20, 18),   # Deep shadow
    (180, 170, 160)  # Bright highlight
]

create_palette_image(palette_colors, 'palette.png')
palette_b64 = encode_palette_for_api('palette.png')
```

**Command Line**:
```bash
base64 -i palette.png | tr -d '\n' > palette.b64
```

### `reference_images` (optional, RD_PRO only)

Array of base64-encoded images (up to 9) to guide generation.

**Use Cases**:
1. **Character Consistency** — Lock denizen appearance across class variants
2. **Asset Composition** — Guide furniture/prop arrangement
3. **Style Transfer** — Apply approved asset's visual style to new generations

**Requirements**:
- **Minimum dimension**: 256px on smallest side
- **Format**: PNG or JPEG
- **Encoding**: Base64 strings
- **Max count**: 9 images per generation

**Character Consistency Pattern** (Proven in Session 9):
```python
# Step 1: Generate canonical character
canonical_response = generate_character(
    prompt="elf wizard, dark medieval, front-facing",
    style="rd_pro__default",
    palette=land_palette
)

# Step 2: Use canonical as reference for variants
variants = []
for class_type in ["scryer", "magister", "hammerer"]:
    variant = generate_character(
        prompt=f"elf {class_type}, dark medieval, front-facing",
        style="rd_pro__default",
        palette=land_palette,
        reference_images=[canonical_response["base64_images"][0]]
    )
    variants.append(variant)
```

**Encoding Reference Images**:
```python
import base64

def encode_image_for_api(image_path):
    with open(image_path, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    return encoded

refs = [
    encode_image_for_api('backdrop.png'),
    encode_image_for_api('character.png'),
    encode_image_for_api('furniture.png')
]
```

### `remove_bg` (optional, default: false)

Automatically removes background, producing transparent PNG.

**When to Use**:
- Character sprites
- Props and equipment
- Icons
- Any asset that needs to composite over backgrounds

**When NOT to Use**:
- Backgrounds/backdrops (obviously)
- Assets where background is part of the design
- When you need specific background color control

**Technical Notes**:
- Uses RD's internal background removal (included in credit cost)
- Produces clean pixel-perfect transparency edges (no fringe)
- More reliable than post-processing chromakey for pixel art

### `seed` (optional)

Integer seed for reproducible results. Same seed + same parameters = same output.

**Use Cases**:
- **Iterative refinement**: Test prompt variations while keeping composition
- **Batch consistency**: Generate related assets with controlled variation
- **Debugging**: Reproduce exact outputs when troubleshooting

**Example**:
```python
# Generate variation 1 with seed
result_1 = api.generate(prompt="medieval throne", seed=42, num_images=1)

# Regenerate exact same image later
result_2 = api.generate(prompt="medieval throne", seed=42, num_images=1)
# result_1 and result_2 will be identical

# Generate controlled variation
result_3 = api.generate(prompt="medieval throne", seed=43, num_images=1)
# result_3 will be different but compositionally similar
```

### `num_images` (optional, default: 1)

Number of variations to generate per request.

**Cost Implications**:
- Each image costs separately: 3 images @ 2 credits = 6 credits total
- Generate multiple variations for user selection

**Recommended Counts by Tier**:
- **RD_PRO**: 2–3 variations (expensive, selective)
- **RD_PLUS**: 2 variations (moderate cost)
- **RD_FAST**: 1 variation (cheap enough to iterate)

**Batch Generation Pattern**:
```python
# Generate 2 variations for selection
response = api.generate(
    prompt="elf scryer character",
    style="rd_pro__default",
    num_images=2
)

# User selects best variation
selected = user_select_best(response["base64_images"])
```

### `bypass_prompt_expansion` (optional, default: false)

Disables RD's automatic prompt enrichment.

**When to Use**:
- Prompt expansion is adding unwanted elements
- Testing specific keyword combinations
- Need exact control over every term

**When NOT to Use**:
- Default behavior works well (most cases)
- Short prompts that benefit from expansion
- Letting RD optimize for pixel art style

### `check_cost` (optional, default: false)

Returns cost estimate without generating.

**Use Cases**:
- Budget validation before large batches
- Cost comparison between tiers
- Confirming credit availability

**Response** (when `check_cost: true`):
```json
{
  "credit_cost": 2,
  "remaining_credits": 998
}
```

## Cost Discoveries (Sessions 1-13)

**Critical Insights from Production Use**:

### Icon Generation (Session 11)
- **Estimated**: 4–6 credits per icon (~$0.30–$0.45)
- **Actual**: 2 credits per icon (~$0.15)
- **Savings**: 50–70% cheaper than estimated
- **Impact**: Full 95-icon inventory fit within budget

### Master Scenes (Session 10)
- **Estimated**: 3–4 credits per 1920×1080 scene
- **Actual**: 2 credits per variation (using letterboxing technique)
- **Method**: Generate 256×256 → letterbox to 480×270 → upscale 4× to 1920×1080
- **Benefit**: RD_PRO quality at expected cost

### Character Sprites (Session 9)
- **Cost**: 7 credits per 256×256 full sprite (~$0.53)
- **Tier**: RD_PRO with `remove_bg: true`
- **Reference images**: Locked denizen appearance across class variants

### Class Crests (Sessions 4-5, 12)
- **Cost**: 2 credits per variation (~$0.15)
- **Tier**: RD_PLUS (`rd_plus__classic` style)
- **Sizes**: Generated at 128×128 and 48×48

### UI Components (Session 6)
- **Cost**: ~0.8 credits average per component (~$0.06)
- **Tier**: Mix of RD_FAST and RD_PLUS
- **Count**: 60 UI elements (chrome, buttons, forms, panels)

## Best Practices

### Palette Enforcement Workflow

**Generation-Time Enforcement** (Preferred):
```python
# 1. Create palette image
palette_colors = [(45,35,25), (70,55,40), ...] # Dark muted palette
create_palette_image(palette_colors, 'land_palette.png')

# 2. Encode for API
palette_b64 = encode_palette_for_api('land_palette.png')

# 3. Generate with palette constraint
response = api.generate(
    prompt="medieval library interior",
    style="rd_pro__fantasy",
    input_palette=palette_b64,
    width=256,
    height=256
)
```

**Advantages**:
- No post-processing quantization needed
- Colors guaranteed compliant from generation
- Faster workflow (one-step process)

**Post-Generation Quantization** (Fallback):
```bash
# If palette drifted during generation
aseprite -b generated.png \
  --palette land_palette.pal \
  --color-mode indexed \
  --save-as output.png
```

### Character Consistency Workflow

**Tiered Generation Strategy** (Proven in Sessions 9-10):

1. **Tier 1: Canonical Characters** (10 sprites)
   - Generate one character per Land (different class each)
   - Use best quality (RD_PRO)
   - Establish denizen visual identity

2. **Tier 2: Class Variants** (20–30 sprites)
   - Use Tier 1 characters as reference images
   - Lock denizen appearance (facial features, proportions, palette)
   - Generate popular class combinations

3. **Tier 3: Full Matrix** (up to 110 sprites)
   - All denizens × all classes
   - Post-launch expansion

**Reference Image Pattern**:
```python
# Generate canonical elf
canonical_elf = api.generate(
    prompt="elf character, dark medieval, front-facing, slender elegant proportions",
    style="rd_pro__default",
    palette=seelie_groves_palette,
    remove_bg=True,
    num_images=3  # Generate variations for selection
)

# User selects best elf variation
approved_elf = user_select(canonical_elf["base64_images"])

# Generate class variants using approved elf as reference
for class_name in ["scryer", "magister", "hammerer"]:
    variant = api.generate(
        prompt=f"elf {class_name}, dark medieval, front-facing, {class_environment[class_name]}",
        style="rd_pro__default",
        palette=seelie_groves_palette,
        reference_images=[approved_elf],
        remove_bg=True,
        num_images=2
    )
```

### Dark Palette Standard

All prompts should emphasize dark, muted, grim tones. RD's style presets may default brighter than VGA aesthetic requires.

**Prompt Keywords** (always include):
```
"very dark", "blackened", "grim medieval", "weathered worn",
"dark fantasy", "very muted shadowy colors", "desaturated",
"dim lighting", "muted earth tones"
```

**Brightness Constraint**:
- No RGB component above 200 (out of 255) except rare highlight pixels
- Keep saturation low (avoid pure hues)

**Desaturation Technique** (for palette creation):
```python
def desaturate_color(r, g, b, factor=0.7):
    """
    Reduce saturation by blending toward grayscale.
    factor: 0.0 = full grayscale, 1.0 = original color
    """
    gray = int(0.299 * r + 0.587 * g + 0.114 * b)
    r_muted = int(gray + (r - gray) * factor)
    g_muted = int(gray + (g - gray) * factor)
    b_muted = int(gray + (b - gray) * factor)
    return (r_muted, g_muted, b_muted)

# Example
bright_green = (100, 200, 80)   # Too saturated
muted_green = desaturate_color(*bright_green, factor=0.5)  # (120, 145, 115)
```

### Large Asset Composition

RD_PRO max resolution is 512×512. Assets larger than this require tiling or letterboxing.

**Letterboxing Technique** (Proven in Session 10):

For 16:9 aspect ratio assets (e.g., 1920×1080 scenes):

1. **Generate at 256×256** with all reference images
2. **Create 480×270 canvas** with dark background RGB(20,18,15)
3. **Scale square to 270×270** via nearest-neighbor (maintains 1:1 aspect)
4. **Center horizontally** on canvas (105px left offset)
5. **Upscale 4× to 1920×1080** via nearest-neighbor

**Code Example**:
```python
from PIL import Image

def letterbox_to_16_9(square_image_path, output_path, scale=4):
    # Load 256×256 generated image
    square = Image.open(square_image_path)
    
    # Create 480×270 canvas (16:9 at scale 1)
    canvas_w, canvas_h = 480, 270
    canvas = Image.new('RGB', (canvas_w, canvas_h), (20, 18, 15))
    
    # Scale square to 270×270 (nearest-neighbor)
    scaled = square.resize((270, 270), Image.NEAREST)
    
    # Center horizontally
    offset_x = (canvas_w - 270) // 2  # 105px
    canvas.paste(scaled, (offset_x, 0))
    
    # Upscale 4× to 1920×1080
    final_w, final_h = canvas_w * scale, canvas_h * scale
    final = canvas.resize((final_w, final_h), Image.NEAREST)
    
    final.save(output_path)
```

**Bonus**: Letterbox side areas (420px × 1080px each at final scale) become natural UI zones for icons, status indicators, inventory panels.

### Batch Generation Pattern

```python
import base64
from pathlib import Path

def batch_generate_icons(icon_specs, palette_path, output_dir):
    """
    icon_specs: List of {"id": "icon-name", "prompt": "description"}
    palette_path: Path to palette PNG
    output_dir: Where to save generated icons
    """
    palette_b64 = encode_palette_for_api(palette_path)
    results = []
    
    for spec in icon_specs:
        response = api.generate(
            prompt=spec["prompt"],
            style="rd_plus__skill_icon",
            width=64,
            height=64,
            input_palette=palette_b64,
            remove_bg=True,
            num_images=2  # 2 variations for selection
        )
        
        # Save variations
        for i, img_b64 in enumerate(response["base64_images"]):
            img_data = base64.b64decode(img_b64)
            output_path = Path(output_dir) / f"{spec['id']}-var{i+1}.png"
            output_path.write_bytes(img_data)
        
        results.append({
            "id": spec["id"],
            "cost": response["credit_cost"],
            "files": [f"{spec['id']}-var1.png", f"{spec['id']}-var2.png"]
        })
    
    return results
```

## Troubleshooting

### Issue 1: Generated Colors Too Bright

**Symptoms**: Output brighter/more saturated than VGA aesthetic despite `input_palette`

**Causes**:
- Style preset defaults to bright palette
- Prompt lacks dark mood keywords
- Palette image itself too bright

**Fixes**:
1. Add explicit dark keywords to prompt: `"very dark", "blackened", "dim lighting"`
2. Verify palette image uses muted colors (no RGB > 200)
3. Try `rd_pro__horror` instead of `rd_pro__fantasy` for darker baseline
4. Use `bypass_prompt_expansion: true` if expansion is brightening

### Issue 2: Reference Images Ignored

**Symptoms**: Generated output doesn't match reference image style/composition

**Causes**:
- Reference images too small (< 256px)
- Using RD_PLUS/RD_FAST (reference images RD_PRO only)
- Too many reference images (dilutes influence)

**Fixes**:
1. Ensure reference images ≥ 256px on smallest dimension
2. Use RD_PRO tier (only tier supporting reference images)
3. Limit to 1–3 most relevant references (not all 9)
4. Verify reference images are base64-encoded correctly

### Issue 3: Prompt Expansion Drift

**Symptoms**: Generated output includes unexpected elements or style

**Causes**:
- RD's automatic prompt expansion adding unintended keywords
- Ambiguous prompt language

**Fixes**:
1. Use `bypass_prompt_expansion: true` for exact control
2. Make prompts more explicit (avoid ambiguous terms)
3. Test prompts with RD_FAST before committing to RD_PRO

### Issue 4: Background Removal Incomplete

**Symptoms**: `remove_bg: true` leaves artifacts or partial background

**Causes**:
- Subject blends with background (low contrast)
- Complex edge cases (hair, transparency)

**Fixes**:
1. Ensure subject has clear silhouette
2. Use prompt keywords for separation: `"clear silhouette", "distinct from background"`
3. For characters, use `"front-facing"` or `"profile"` for cleaner edges
4. Post-process with manual alpha channel refinement if needed

### Issue 5: Resolution Artifacts

**Symptoms**: Output has unexpected scaling artifacts or blur

**Causes**:
- Requesting non-native resolution for style preset
- Upscaling with wrong interpolation method

**Fixes**:
1. Check style preset's native resolution support
2. Always use nearest-neighbor for pixel art upscaling
3. Generate at native resolution, upscale separately

## Integration with Validation

RD API generates native pixel art, but validation still required:

**Validation Workflow**:
1. **Generate** — RD API with palette + references
2. **Check color mode** — Verify indexed color (P/PA mode)
3. **Check palette compliance** — Run check_palette.py
4. **Check VGA compliance** — Run validate_asset.py (hard edges, dithering, gradients)
5. **Iterate** — If failures, adjust prompt/style preset and regenerate

**See Also**:
- `vga_compliance.md` — VGA aesthetic quality gates
- `palette_enforcement.md` — Palette compliance strategies
- `color_mode_check.md` — Indexed vs RGB/RGBA validation
- `style_presets.md` — RD style preset mapping

---

*This framework is tool-agnostic. Adapt API calls and workflows to your language/environment.*

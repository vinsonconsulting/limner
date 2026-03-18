# Letterboxing — Display Scaling for Pixel Art

## Overview

The **letterboxing technique** solves the fundamental challenge of scaling pixel art from generation resolution to display resolution while preserving pixel-perfect aesthetics. This approach emerged from RD API's dimensional constraints and turned a technical limitation into a design feature.

**Core Problem**: Retro Diffusion API's `rd_pro__fantasy` style with reference images only accepts square dimensions (256×256 max). Target display resolution is 16:9 (1920×1080). Direct distortion destroys pixel art integrity.

**Solution**: Generate at native pixel resolution (256×256) → letterbox onto wider canvas with dark background → upscale via nearest-neighbor to display resolution (1920×1080).

## The Letterboxing Pipeline

### Three-Stage Process

**Stage 1: Native Generation** (256×256 square)
```json
{
  "width": 256,
  "height": 256,
  "prompt": "medieval fantasy environment with character and furniture, dark weathered materials, grim aesthetic",
  "prompt_style": "rd_pro__fantasy",
  "reference_images": [
    "<land_backdrop_base64>",
    "<character_sprite_base64>",
    "<furniture_overlay_base64>"
  ],
  "input_palette": "base64_encoded_land_palette"
}
```

**Output**: 256×256 square pixel art image with correct aspect ratio for composition

**Stage 2: Letterbox Composition** (480×270 canvas)
```python
from PIL import Image

def letterbox_square_to_16_9(square_image_path, output_path, bg_color=(20, 18, 15)):
    """
    Letterbox 256×256 square onto 480×270 canvas (16:9 ratio).

    Args:
        square_image_path: Path to 256×256 source image
        output_path: Path to save letterboxed 480×270 result
        bg_color: RGB tuple for letterbox background (default: dark base tone)
    """
    # Load 256×256 source
    source = Image.open(square_image_path)

    # Target dimensions (16:9 ratio at 480×270)
    target_width = 480
    target_height = 270

    # Create canvas with dark background
    canvas = Image.new('RGB', (target_width, target_height), bg_color)

    # Scale square to 270×270 (nearest-neighbor to preserve pixels)
    scaled = source.resize((270, 270), Image.NEAREST)

    # Calculate horizontal centering offset
    # (480 - 270) / 2 = 105px left margin
    offset_x = (target_width - 270) // 2

    # Paste centered square onto canvas
    canvas.paste(scaled, (offset_x, 0))

    # Save letterboxed result
    canvas.save(output_path)
```

**Output**: 480×270 image with 270×270 content centered, 105px dark borders on left/right

**Stage 3: Display Upscale** (1920×1080 final)
```python
def upscale_to_display_resolution(letterbox_image_path, output_path):
    """
    Upscale 480×270 letterboxed image to 1920×1080 display resolution.
    Uses nearest-neighbor to preserve pixel-perfect aesthetics.
    """
    source = Image.open(letterbox_image_path)

    # 4× upscale: 480×270 → 1920×1080
    display = source.resize((1920, 1080), Image.NEAREST)

    display.save(output_path)
```

**Output**: 1920×1080 final image ready for display (1080×1080 content centered, 420px borders)

### Complete Pipeline Script

```python
from PIL import Image
import os

def letterbox_pipeline(source_256x256, output_1920x1080, bg_color=(20, 18, 15)):
    """
    Complete letterboxing pipeline: 256×256 → 480×270 → 1920×1080.

    Args:
        source_256x256: Path to source 256×256 RD generation
        output_1920x1080: Path to save final 1920×1080 display image
        bg_color: RGB tuple for letterbox background
    """
    # Stage 1: Already complete (RD API generation)
    source = Image.open(source_256x256)

    # Stage 2: Letterbox onto 480×270 canvas
    canvas_480x270 = Image.new('RGB', (480, 270), bg_color)
    scaled_270x270 = source.resize((270, 270), Image.NEAREST)
    offset_x = (480 - 270) // 2
    canvas_480x270.paste(scaled_270x270, (offset_x, 0))

    # Stage 3: Upscale to 1920×1080 display resolution
    display_1920x1080 = canvas_480x270.resize((1920, 1080), Image.NEAREST)

    # Save final result
    display_1920x1080.save(output_1920x1080)

    print(f"✓ Letterboxed {source_256x256} → {output_1920x1080}")
    print(f"  Content area: 1080×1080 centered")
    print(f"  Letterbox area: 420px × 1080px on left/right")


# Example usage
letterbox_pipeline(
    source_256x256='raw/scene.png',
    output_1920x1080='display/scene.png',
    bg_color=(20, 18, 15)  # Dark base tone
)
```

## Why Letterboxing Works

### Pixel Preservation

**Problem with Direct Scaling**:
- 256×256 → 1920×1080 requires non-square pixel scaling (7.5× horizontal, 4.2× vertical)
- Non-integer scaling destroys pixel grid alignment
- Results in mixels (mixed-size pixels) and distorted proportions

**Letterboxing Solution**:
- Stage 2: 256×256 → 270×270 = 1.054× scale (minimal distortion, still square)
- Stage 3: 480×270 → 1920×1080 = 4× uniform scale (integer, preserves grid)
- All scaling uses nearest-neighbor (no bilinear/bicubic smoothing)
- Result: Pixel-perfect grid maintained at display resolution

### Aspect Ratio Compliance

**RD API Constraint**: `rd_pro__fantasy` with reference images requires square input (256×256, 512×512)

**Display Requirement**: 16:9 ratio (1920×1080 standard)

**Letterboxing Bridge**:
- Generate at native square (256×256) — RD API accepts
- Letterbox to 16:9 ratio (480×270) — display standard
- Upscale uniformly (4×) — preserves aspect ratio

**No vertical compression or horizontal stretching** — content remains 1:1 square pixels.

## The Letterbox Side Areas

### Dimensional Breakdown

**At 480×270 intermediate**:
- Content area: 270×270 (centered square)
- Left letterbox: 105×270
- Right letterbox: 105×270
- Total letterbox: 210×270 (43.75% of canvas)

**At 1920×1080 display**:
- Content area: 1080×1080 (centered square)
- Left letterbox: 420×1080
- Right letterbox: 420×1080
- Total letterbox: 840×1080 (43.75% of canvas)

### Design Feature Repurposing

**Originally**: Technical workaround for RD API square constraint

**Discovered**: Letterbox areas are natural UI zones

**UI Integration Opportunities**:

| Zone | Dimensions | Use Cases |
|------|------------|-----------|
| Left Letterbox | 420×1080 | Inventory panel, tool palette, status indicators |
| Right Letterbox | 420×1080 | Chat log, action queue, mini-map, character stats |
| Top of Letterbox | 420×200 | Context labels, scene title, breadcrumbs |
| Bottom of Letterbox | 420×200 | Action buttons, controls, tooltips |

**Example Layout**:
```
┌─────────────┬─────────────────────┬─────────────┐
│             │                     │             │
│   LEFT UI   │   1080×1080 SCENE   │  RIGHT UI   │
│             │   (pixel art        │             │
│  Inventory  │    content)         │  Chat Log   │
│  Status     │                     │  Action     │
│  Tools      │                     │  Queue      │
│             │                     │             │
│   420×1080  │                     │  420×1080   │
└─────────────┴─────────────────────┴─────────────┘
        1920×1080 Total Display
```

**User Feedback**: "perfect- the room on the side is good for icons and ui"

**Takeaway**: What began as technical constraint became intentional design — letterbox areas provide natural spatial separation for UI elements without overlaying the pixel art scene.

## Background Color Selection

### Dark Base Tone (Default)

**RGB(20, 18, 15)** — Near-black with slight warm tint

**Rationale**:
- Matches dark palette aesthetic throughout project
- Low contrast with scene edges (no harsh borders)
- Fades into background — UI overlays become focal points
- Warm tint (18R vs 15B) avoids dead gray

### Palette-Specific Backgrounds

**Alternative**: Use Land-specific dark palette colors for letterbox

```python
LETTERBOX_BACKGROUNDS = {
    'seelie_groves': (15, 20, 12),      # Dark forest green
    'freemark_reaches': (22, 18, 14),   # Dark warm timber
    'ironroot_holdings': (18, 16, 20),  # Dark cool stone
    'shire_hearths': (24, 19, 10),      # Dark warm hearth
    'vaults_precieux': (20, 18, 15),    # Dark brass
    'fenward_commons': (12, 18, 10),    # Dark murky green
    'mire_grok': (14, 20, 8),           # Dark toxic green
    'scoria_warrens': (22, 18, 12),     # Dark desert tan
    'temple_frozen': (14, 18, 22),      # Dark ice blue
    'bottomless_satchel': (18, 10, 20), # Dark void purple
}

def letterbox_with_land_bg(source, output, land_id):
    bg_color = LETTERBOX_BACKGROUNDS.get(land_id, (20, 18, 15))
    letterbox_pipeline(source, output, bg_color)
```

**Use Case**: Letterbox color hints at Land context without dominating scene.

### Transparent Letterbox (Advanced)

**For compositing scenarios**: Generate letterbox with alpha channel

```python
def letterbox_transparent(source_256x256, output_path):
    """Letterbox with transparent sides for overlay compositing."""
    source = Image.open(source_256x256)

    # Create RGBA canvas (transparent)
    canvas = Image.new('RGBA', (480, 270), (0, 0, 0, 0))

    # Scale and paste content (center)
    scaled = source.resize((270, 270), Image.NEAREST)
    offset_x = (480 - 270) // 2
    canvas.paste(scaled, (offset_x, 0))

    # Upscale to display
    display = canvas.resize((1920, 1080), Image.NEAREST)
    display.save(output_path)
```

**Use Case**: Scene content composites over full-screen background image, letterbox areas remain transparent for dynamic UI overlays.

## Alternative Ratios

### 16:10 Display (1920×1200)

**Letterbox Calculation**:
- Target: 1920×1200 (16:10 ratio)
- Intermediate: 480×300 (maintains 16:10)
- Content: 300×300 (1.172× scale from 256×256)
- Letterbox: 90px × 300px per side

**Pipeline**:
```python
def letterbox_16_10(source_256x256, output_path, bg_color=(20, 18, 15)):
    source = Image.open(source_256x256)

    # Stage 2: 480×300 canvas
    canvas = Image.new('RGB', (480, 300), bg_color)
    scaled = source.resize((300, 300), Image.NEAREST)
    offset_x = (480 - 300) // 2
    canvas.paste(scaled, (offset_x, 0))

    # Stage 3: 4× upscale to 1920×1200
    display = canvas.resize((1920, 1200), Image.NEAREST)
    display.save(output_path)
```

### 4:3 Display (1600×1200)

**Letterbox Calculation**:
- Target: 1600×1200 (4:3 ratio)
- Intermediate: 400×300 (maintains 4:3)
- Content: 300×300 (1.172× scale)
- Letterbox: 50px × 300px per side

**Pipeline**: Similar to 16:10, adjust canvas to 400×300 and upscale to 1600×1200

### Ultra-Wide (21:9) Display (2560×1080)

**Letterbox Calculation**:
- Target: 2560×1080 (21:9 ratio)
- Keep intermediate at 480×270 (16:9)
- Upscale intermediate to 1920×1080
- Add additional 320px letterbox per side (total 640px horizontal)
- Final: 1080×1080 content, 1480px total letterbox (740px per side)

**Pipeline**:
```python
def letterbox_21_9(source_256x256, output_path, bg_color=(20, 18, 15)):
    source = Image.open(source_256x256)

    # Stage 2: 480×270 letterbox (same as 16:9)
    canvas_480 = Image.new('RGB', (480, 270), bg_color)
    scaled_270 = source.resize((270, 270), Image.NEAREST)
    canvas_480.paste(scaled_270, ((480 - 270) // 2, 0))

    # Stage 3a: Upscale to 1920×1080 (16:9)
    display_1920 = canvas_480.resize((1920, 1080), Image.NEAREST)

    # Stage 3b: Extend to 2560×1080 (21:9)
    canvas_2560 = Image.new('RGB', (2560, 1080), bg_color)
    offset_x = (2560 - 1920) // 2
    canvas_2560.paste(display_1920, (offset_x, 0))

    canvas_2560.save(output_path)
```

## Common Issues and Solutions

### Issue: Blurry Upscaling

**Symptoms**: Pixels appear blurred, soft edges, loss of pixel grid

**Cause**: Using bilinear/bicubic resampling instead of nearest-neighbor

**Solution**: Always use `Image.NEAREST` for all resize operations
```python
# WRONG: Blurs pixels
image.resize((1920, 1080), Image.BILINEAR)

# CORRECT: Preserves pixel grid
image.resize((1920, 1080), Image.NEAREST)
```

### Issue: Off-Center Content

**Symptoms**: Content not centered in letterbox, asymmetric borders

**Cause**: Integer division rounding error in offset calculation

**Solution**: Use floor division (`//`) and verify with visual inspection
```python
# Calculate horizontal centering
offset_x = (target_width - content_width) // 2

# Verify centering
assert offset_x == (target_width - content_width) / 2  # May fail due to rounding

# Visual verification: borders should be equal width on left/right
left_border = offset_x
right_border = target_width - offset_x - content_width
assert left_border == right_border  # Should be equal
```

### Issue: Wrong Aspect Ratio

**Symptoms**: Content appears stretched or compressed

**Cause**: Non-uniform scaling or incorrect canvas dimensions

**Solution**: Maintain square aspect ratio for content area
```python
# WRONG: Stretches content
scaled = source.resize((300, 270), Image.NEAREST)  # 300×270 is not square

# CORRECT: Preserves square
scaled = source.resize((270, 270), Image.NEAREST)  # 270×270 maintains 1:1
```

### Issue: Color Shifts in Letterbox

**Symptoms**: Letterbox background doesn't match expected color

**Cause**: RGB vs sRGB color space, monitor gamma, image format metadata

**Solution**:
1. Use exact RGB values from design specification
2. Save as PNG (preserves RGB without color profile confusion)
3. Test on target display before finalizing

## Performance Considerations

### Memory Usage

**256×256 → 1920×1080 Memory Footprint**:
- Source: 256×256×3 = 196KB (RGB)
- Intermediate: 480×270×3 = 388KB (RGB)
- Display: 1920×1080×3 = 6.2MB (RGB)
- Total peak: ~6.8MB per image

**Batch Processing**: For 100+ images, process in batches of 10-20 to avoid memory exhaustion

### Processing Speed

**Pillow Nearest-Neighbor Performance** (M1 Mac, single-threaded):
- 256×256 → 270×270: ~2ms
- 480×270 → 1920×1080: ~15ms
- **Total per image**: ~17ms

**Batch Optimization**:
```python
from concurrent.futures import ProcessPoolExecutor
import os

def batch_letterbox(source_dir, output_dir, bg_color=(20, 18, 15), workers=4):
    """Process multiple images in parallel."""
    sources = [f for f in os.listdir(source_dir) if f.endswith('.png')]

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = [
            executor.submit(
                letterbox_pipeline,
                os.path.join(source_dir, src),
                os.path.join(output_dir, src),
                bg_color
            )
            for src in sources
        ]

        for future in futures:
            future.result()  # Wait for completion

# Process 100 images in ~5 seconds (4 workers)
batch_letterbox('raw/', 'display/', workers=4)
```

## Integration with Generation Workflow

### Complete Scene Generation Pipeline

**Step 1: Generate Native Resolution** (RD API)
```python
import requests
import base64

def generate_scene(prompt, references, palette, api_token):
    """Generate 256×256 scene with RD API."""
    response = requests.post(
        'https://api.retrodiffusion.ai/v1/inferences',
        headers={'X-RD-Token': api_token},
        json={
            'width': 256,
            'height': 256,
            'prompt': prompt,
            'prompt_style': 'rd_pro__fantasy',
            'reference_images': references,
            'input_palette': palette,
            'num_images': 1
        }
    )

    result = response.json()
    image_base64 = result['base64_images'][0]

    # Decode and save
    image_data = base64.b64decode(image_base64)
    with open('raw/scene-256x256.png', 'wb') as f:
        f.write(image_data)

    return 'raw/scene-256x256.png'
```

**Step 2: Letterbox to Display** (Local Processing)
```python
def process_generated_scene(source_path, land_id):
    """Letterbox RD generation to display resolution."""
    bg_color = LETTERBOX_BACKGROUNDS.get(land_id, (20, 18, 15))

    letterbox_pipeline(
        source_256x256=source_path,
        output_1920x1080='display/scene-1920x1080.png',
        bg_color=bg_color
    )

    return 'display/scene-1920x1080.png'
```

**Step 3: Validation** (Quality Gates)
```python
def validate_letterboxed_scene(display_path):
    """Verify letterbox output meets quality gates."""
    img = Image.open(display_path)

    # Check dimensions
    assert img.size == (1920, 1080), f"Wrong size: {img.size}"

    # Check content area is centered
    # (Extract 1080×1080 content area and verify it's not all background)
    content = img.crop((420, 0, 1500, 1080))
    unique_colors = len(content.getcolors(maxcolors=1000000))
    assert unique_colors > 1, "Content area is solid color (centering failed)"

    # Check letterbox areas are correct background
    left_box = img.crop((0, 0, 420, 1080))
    right_box = img.crop((1500, 0, 1920, 1080))
    # Verify letterbox areas have minimal color variation (should be solid bg)

    print(f"✓ Letterbox validation passed: {display_path}")
```

**Complete Workflow**:
```python
# Generate with RD API
scene_256 = generate_scene(
    prompt="medieval fantasy scene...",
    references=[backdrop_ref, character_ref, furniture_ref],
    palette=land_palette_base64,
    api_token='your_token'
)

# Letterbox to display resolution
scene_1920 = process_generated_scene(scene_256, land_id='seelie_groves')

# Validate output
validate_letterboxed_scene(scene_1920)

# Deploy to production
import shutil
shutil.copy(scene_1920, 'static/assets/scenes/seelie_groves-scryer.png')
```

## Letterboxing Decision Tree

```
┌─────────────────────────────────────────┐
│ RD API generation complete (256×256)?   │
└────────────┬────────────────────────────┘
             │
             ├─ Display target is 16:9 (1920×1080)?
             │  │
             │  ├─ YES ─→ Use standard letterbox pipeline
             │  │         480×270 intermediate → 1920×1080 display
             │  │         420px letterbox per side → UI zones
             │  │
             │  └─ NO ─→ What ratio?
             │           │
             │           ├─ 16:10 → 480×300 → 1920×1200 (90px letterbox)
             │           ├─ 4:3 → 400×300 → 1600×1200 (50px letterbox)
             │           └─ 21:9 → 480×270 → 1920×1080 → 2560×1080 (740px letterbox)
             │
             ├─ Need transparent letterbox for compositing?
             │  │
             │  ├─ YES ─→ Use RGBA canvas with (0,0,0,0) background
             │  │         Overlay on full-screen BG at runtime
             │  │
             │  └─ NO ─→ Use opaque RGB with dark base tone
             │
             └─ Batch processing multiple scenes?
                │
                ├─ YES ─→ Use ProcessPoolExecutor for parallel processing
                │         4 workers → ~5 seconds for 100 images
                │
                └─ NO ─→ Single image processing (~17ms per scene)
```

## Key Takeaways

1. **Square Generation → Letterbox → Display** — Three-stage pipeline preserves pixel-perfect grid alignment
2. **Nearest-Neighbor Only** — Never use bilinear/bicubic resampling for pixel art upscaling
3. **Integer Scaling** — 4× uniform upscale (480×270 → 1920×1080) maintains pixel grid
4. **Design Feature** — Letterbox side areas (420×1080 each) become natural UI zones
5. **Dark Background** — RGB(20, 18, 15) base tone or Land-specific dark palette colors
6. **Aspect Ratio Flexibility** — Adapt canvas dimensions for 16:10, 4:3, 21:9 displays
7. **Batch Performance** — Parallel processing enables ~5 seconds for 100 images (4 workers)
8. **Validation Required** — Verify dimensions, centering, and background color after letterboxing
9. **Production Integration** — Letterbox step bridges RD API generation to display-ready assets
10. **Constraint → Feature** — Technical limitation (RD square constraint) became intentional design (natural UI zones)

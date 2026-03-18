# Palette Enforcement — Constraint-Based Color Management

> Framework for enforcing themed color palettes in pixel art generation

## Overview

Palette enforcement ensures pixel art assets use only colors from predefined themed palettes. This is distinct from VGA compliance (aesthetic) and color mode optimization (storage) — palette enforcement is about **color value constraint**.

**Use Cases**:
- Land/region-specific color schemes (e.g., 10 Lands each with unique 9-16 color palette)
- Class/character-specific palettes
- UI theme consistency
- Seasonal/event variants with alternate palettes
- Brand color compliance

## Palette Types

### 1. Land/Region Palettes (Domain-Specific Example)

Small, highly constrained palettes that define visual identity:

**Characteristics**:
- 9-16 colors per palette
- Dark/muted baseline (VGA aesthetic alignment)
- Unique per region/land/zone
- Enforced at generation time

**Example Structure** (from Summoning Chamber):
```
Seelie Groves Palette (9 colors):
- Base: Dark browns, muted greens
- Accent: Silver highlights
- Atmosphere: Warm amber tones

Ironroot Holdings Palette (12 colors):
- Base: Dark stone grays
- Accent: Copper/bronze metallics
- Atmosphere: Cool blue shadows + warm forge glow
```

### 2. UI Chrome Palette (Framework-Level)

Neutral palette for UI elements that work across all themed palettes:

**Characteristics**:
- 12-20 colors
- Grayscale base with subtle warm/cool variations
- Dark medieval aesthetic
- Works on any background

**Use For**:
- Buttons, panels, frames, borders
- Icons that appear across multiple contexts
- Status indicators
- Navigation elements

### 3. Full 256-Color VGA Palette (Maximum)

When you need the full VGA color space:

**Use For**:
- Complex scenes with many materials
- Cross-palette composition (multiple Lands in one scene)
- Fallback when themed palette is too restrictive

## Enforcement Strategies

### Strategy 1: Generation-Time Enforcement (Preferred)

Enforce palette at asset creation via generation tool parameters.

**Retro Diffusion API Example**:
```json
{
  "prompt": "medieval fantasy environment",
  "input_palette": "base64_encoded_palette_image",
  "style": "rd_pro__fantasy"
}
```

**How It Works**:
1. Create palette reference image (8×2 grid of palette colors)
2. Encode as base64
3. Pass via `input_palette` parameter
4. RD API constrains generation to these colors

**Advantages**:
- No post-processing needed
- Colors guaranteed compliant
- Faster workflow

**Disadvantages**:
- Requires generation tool support
- May limit visual quality if palette too small

### Strategy 2: Post-Generation Quantization

Generate freely, then quantize to palette afterward.

**Using Aseprite CLI**:
```bash
# With specific palette file
aseprite -b input.png \
  --palette land_palette.pal \
  --color-mode indexed \
  --save-as output.png
```

**Using ImageMagick**:
```bash
# Remap to palette image
convert input.png -remap palette_reference.png output.png
```

**Using Python (Pillow)**:
```python
from PIL import Image

def quantize_to_palette(input_path, palette_path, output_path):
    img = Image.open(input_path).convert('RGB')
    palette_img = Image.open(palette_path).convert('P')

    # Quantize using palette
    quantized = img.quantize(palette=palette_img)
    quantized.save(output_path)
```

**Advantages**:
- Works with any generation tool
- Allows high-quality initial generation
- Can try multiple palettes on same source

**Disadvantages**:
- Extra processing step
- May introduce quantization artifacts
- Colors might not match exactly if source uses too many colors

### Strategy 3: Hybrid Approach

Generate with loose palette constraint, refine with strict quantization.

**Workflow**:
1. Generate with `input_palette` (80% constraint)
2. Validate color count
3. If >palette limit, run Aseprite quantization
4. Validate again

**Best For**:
- Complex scenes where generation-time enforcement too restrictive
- Assets requiring specific material textures
- When you need both quality and compliance

## Palette Creation Workflow

### Step 1: Define Palette Colors

**For Land/Region Palettes**:
```
Base Colors (4-6):
- Primary material color (stone, wood, metal)
- Secondary material color
- Shadow color (darker than base)
- Highlight color (lighter than base)

Accent Colors (2-4):
- Unique identifying color (e.g., silver for Seelie, copper for Ironroot)
- Secondary accent (optional)

Atmospheric Colors (2-4):
- Light source color (warm/cool)
- Ambient shadow color
- Optional glow/magic color
```

**Color Selection Principles**:
- Start with grayscale, then add hue
- Dark/muted baseline (VGA aesthetic)
- High contrast between base and accent
- Avoid pure black/white (use RGB(20,18,15) and RGB(220,215,210) instead)

### Step 2: Create Palette Reference Image

**Format**: 8×2 grid PNG (16 colors max) or 8×1 grid (8 colors)

**Using Python (Pillow)**:
```python
from PIL import Image

def create_palette_image(colors, output_path):
    """
    colors: List of (R,G,B) tuples
    Creates 8x2 grid palette image
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

# Example: Seelie Groves palette
seelie_colors = [
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

create_palette_image(seelie_colors, 'seelie_groves_palette.png')
```

**Using Aseprite GUI**:
1. Create new 8×2 sprite
2. Fill each pixel with palette color
3. Export as PNG
4. Save as .pal file: File → Export → Palette

### Step 3: Base64 Encode for API

**Python**:
```python
import base64

def encode_palette_for_api(palette_path):
    with open(palette_path, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    return encoded

palette_b64 = encode_palette_for_api('seelie_groves_palette.png')
```

**Command Line**:
```bash
base64 -i seelie_groves_palette.png | tr -d '\n' > palette.b64
```

## Validation Workflow

### Palette Compliance Check

**Using Custom Script** (`check_palette.py` example):
```python
from PIL import Image
import sys

def check_palette_compliance(image_path, palette_path, tolerance=5):
    """
    Checks if image uses only colors from palette (within tolerance).
    Returns: (is_compliant, extra_colors_count, report)
    """
    img = Image.open(image_path).convert('RGB')
    palette_img = Image.open(palette_path).convert('RGB')

    # Extract palette colors
    palette_colors = set()
    for y in range(palette_img.height):
        for x in range(palette_img.width):
            palette_colors.add(palette_img.getpixel((x, y)))

    # Extract image colors
    image_colors = set(img.getdata())

    # Check compliance (exact match or within tolerance)
    extra_colors = []
    for color in image_colors:
        if color not in palette_colors:
            # Check if within tolerance
            matches = any(
                all(abs(c1 - c2) <= tolerance for c1, c2 in zip(color, pal_color))
                for pal_color in palette_colors
            )
            if not matches:
                extra_colors.append(color)

    is_compliant = len(extra_colors) == 0
    report = f"Palette: {len(palette_colors)} colors | Image: {len(image_colors)} colors | Extra: {len(extra_colors)}"

    return is_compliant, len(extra_colors), report

# Usage
compliant, extra, report = check_palette_compliance(
    'asset.png',
    'seelie_groves_palette.png',
    tolerance=5
)

if compliant:
    print(f"✅ PASS: {report}")
else:
    print(f"❌ FAIL: {report}")
```

**Command Line**:
```bash
python scripts/check_palette.py asset.png --palette seelie_groves
```

### Batch Validation

```bash
# Validate all assets in directory against Land palette
for file in static/assets/lands/seelie-groves/*.png; do
  python scripts/check_palette.py "$file" --palette seelie_groves
done

# Generate compliance report
python scripts/check_palette.py --batch static/assets/ --report
```

**Expected Output**:
```
Palette Compliance Report
=========================

Seelie Groves Assets (45 files):
  ✅ Compliant: 42 files (93%)
  ⚠️  Near-compliant (±5 tolerance): 2 files
  ❌ Non-compliant: 1 file

Non-Compliant Files:
  seelie-groves-backdrop.png: 12 extra colors (smooth gradient detected)
```

## Palette Registry Pattern

For projects with multiple themed palettes, use a registry:

**`docs/palettes/palette_registry.json`**:
```json
{
  "seelie_groves": {
    "name": "Seelie Groves",
    "file": "docs/palettes/seelie_groves.png",
    "pal_file": "docs/palettes/seelie_groves.pal",
    "color_count": 9,
    "description": "Organic wood tones, silver accents, warm amber"
  },
  "ironroot_holdings": {
    "name": "Ironroot Holdings",
    "file": "docs/palettes/ironroot_holdings.png",
    "color_count": 12,
    "description": "Stone grays, copper metallics, forge glow"
  },
  "ui_chrome": {
    "name": "UI Chrome",
    "file": "docs/palettes/ui_chrome.png",
    "color_count": 16,
    "description": "Neutral grayscale, works across all Lands"
  }
}
```

**Loading Palettes in Scripts**:
```python
import json

def load_palette_registry(registry_path='docs/palettes/palette_registry.json'):
    with open(registry_path) as f:
        return json.load(f)

def get_palette_path(palette_id):
    registry = load_palette_registry()
    return registry[palette_id]['file']

# Usage
palette_path = get_palette_path('seelie_groves')
```

## Dark Palette Standard (VGA Aesthetic Alignment)

Even "warm" or "bright" palettes should be **dark and muted** for VGA authenticity.

### Brightness Constraint

**Rule**: No RGB component above 200 (out of 255) except for rare highlight pixels.

**Examples**:
```
❌ Too Bright (Modern Indie Pixel Art):
  Base: RGB(180, 160, 140)  # Too light
  Accent: RGB(255, 220, 100) # Neon yellow

✅ VGA-Appropriate (Dark/Muted):
  Base: RGB(70, 55, 40)      # Dark brown
  Accent: RGB(140, 140, 135)  # Muted silver
```

### Saturation Constraint

**Rule**: Keep saturation low — avoid pure hues.

**Technique**: Start with grayscale, add small amount of hue.

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

### Prompt Keywords for Dark Palettes

When using generation-time enforcement, reinforce with prompt keywords:

```
"very dark", "blackened", "grim medieval", "weathered worn",
"dark fantasy", "very muted shadowy colors", "desaturated",
"dim lighting", "muted earth tones"
```

Even if `input_palette` contains dark colors, generation models may brighten output — explicit prompt keywords help.

## Troubleshooting

### Issue 1: Too Many Colors After Generation

**Symptoms**: Image has 287 colors instead of palette's 16.

**Causes**:
- Anti-aliasing on edges (creates intermediate colors)
- Smooth gradients (continuous color transitions)
- Generation tool ignored `input_palette`

**Fixes**:
1. Remove anti-aliasing first (see `vga_compliance.md`)
2. Run palette quantization with Aseprite
3. Validate again
4. If still failing, check VGA compliance (smooth gradients)

### Issue 2: Palette Quantization Looks Wrong

**Symptoms**: Colors shifted after quantization, material textures lost.

**Causes**:
- Palette too small for asset complexity
- Wrong quantization algorithm (ordered dithering vs Floyd-Steinberg)
- Transparent pixels treated as color

**Fixes**:
1. Expand palette to 16-24 colors
2. Use Floyd-Steinberg dithering: `aseprite -b input.png --dithering-algorithm floyd-steinberg --palette palette.pal --save-as output.png`
3. Ensure palette includes transparent black RGB(0,0,0) if image has transparency

### Issue 3: Palette Enforcement Too Restrictive

**Symptoms**: Generation quality poor, materials lack texture.

**Causes**:
- Palette too small (e.g., 6 colors for complex scene)
- Missing gradient colors (only base + highlight, no intermediates)

**Fixes**:
1. Add 2-3 intermediate colors between base and highlight
2. Add material-specific colors (wood brown, metal gray, etc.)
3. Consider hybrid approach: loose generation + strict quantization

### Issue 4: Colors Look Correct But Validation Fails

**Symptoms**: Visual inspection shows palette compliance, script reports failures.

**Causes**:
- RGB rounding errors (RGB(70,55,40) vs RGB(71,54,41))
- JPEG compression artifacts (use PNG only)
- Color profile differences (sRGB vs Adobe RGB)

**Fixes**:
1. Use tolerance parameter: `check_palette.py --tolerance 5`
2. Ensure both palette and asset are PNG (no JPEG)
3. Convert both to sRGB color space
4. Manual review: If visually compliant, tolerance acceptable

## Integration with Other Validations

Palette enforcement is **one layer** of asset validation:

| Validation | Question | Blocking? |
|------------|----------|-----------|
| **VGA Compliance** | Does it look like a 1990-1993 VGA game? | Yes (MVP) |
| **Palette Enforcement** | Does it use only themed palette colors? | Yes (MVP) |
| **Color Mode** | Is it stored as indexed color (P/PA)? | No (optimization) |

**Workflow Order**:
1. VGA Compliance (aesthetic authenticity)
2. Palette Enforcement (color value constraint)
3. Color Mode Check (storage efficiency)

If VGA fails, fix visual issues before palette enforcement.
If Palette fails, regenerate or quantize before color mode check.

## Example Implementation (Summoning Chamber)

### 10 Land Palettes

Each Land has 9-16 color palette enforced across all Land-specific assets:

**Seelie Groves** (9 colors):
- Organic wood browns, silver accents, warm amber glow
- Used for: Seelie backdrop, Scryer furniture, Elf character

**Ironroot Holdings** (12 colors):
- Massive stone grays, copper metallics, forge glow
- Used for: Ironroot backdrop, Hammerer furniture, Dwarf character

**Mire of Grok** (11 colors):
- Toxic green glow, bone whites, brutal dark browns
- Used for: Mire backdrop, Warden furniture, Orc character

### UI Chrome Palette (16 colors)

Neutral palette for cross-Land UI elements:
- Grayscale base: 8 shades from RGB(20,18,15) to RGB(180,175,170)
- Warm accents: 4 muted browns
- Cool accents: 4 muted grays
- Used for: Buttons, panels, frames, navigation, icons

### Validation Enforcement

```bash
# All Land backdrops must use Land palette
python scripts/check_palette.py static/assets/lands/seelie-groves/backdrop.png --palette seelie_groves

# All UI components must use UI Chrome palette
python scripts/check_palette.py static/assets/ui/buttons/*.png --palette ui_chrome

# Character sprites use denizen's Land palette
python scripts/check_palette.py static/assets/characters/elf/elf-scryer.png --palette seelie_groves
```

---

*This framework is project-agnostic. Adapt palette definitions and validation commands to your specific themed palette structure.*

# Color Mode Validation — Indexed vs RGB/RGBA

> Validation framework for PNG storage format optimization

## Overview

Color **mode** and color **palette** are distinct concepts that are often confused:

- **Color Mode** (P, RGB, RGBA, PA) — How the PNG stores color data internally
- **Color Palette** (actual color values) — The set of colors used in the image

**Critical Discovery (Session 13)**: Both can be correct independently. An RGB-mode PNG can contain perfectly VGA-compliant colors — it's just storing them inefficiently.

## Color Modes Explained

### Indexed Color (P, PA)

**P Mode (Palette)**:
- Stores a palette of up to 256 colors
- Each pixel references a palette index (0-255)
- Most memory-efficient for pixel art
- File size: ~20-40% smaller than RGB for same visual quality

**PA Mode (Palette + Alpha)**:
- Same as P mode but with alpha channel
- Use when transparency is needed with indexed color
- Still more efficient than RGBA

### True Color (RGB, RGBA)

**RGB Mode**:
- Stores full red, green, blue values for each pixel
- 24 bits per pixel (8 bits × 3 channels)
- Works fine for VGA-compliant colors, just larger files

**RGBA Mode**:
- RGB + alpha channel
- 32 bits per pixel
- Most common output from generation tools
- Least efficient for pixel art with limited palettes

## Why This Distinction Matters

### VGA Compliance (Aesthetic Requirement)

**Question**: "Does this asset look like a 1990-1993 VGA game?"

**Checks**:
- ≤256 distinct colors actually used
- Hard pixel edges (no anti-aliasing)
- Appropriate dithering
- Dark/muted palette
- No smooth gradients

**Result**: Pass/fail for visual authenticity

### Color Mode Optimization (Storage Efficiency)

**Question**: "Is this PNG storing color data efficiently?"

**Checks**:
- Indexed (P/PA) vs RGB/RGBA mode
- File size vs visual quality trade-off
- Palette usage (9-16 colors typical for themed assets)

**Result**: Optimization opportunity, not compliance blocker

## Validation Workflow

### Step 1: Check Color Mode

```python
from PIL import Image

def check_color_mode(png_path):
    img = Image.open(png_path)
    mode = img.mode  # 'P', 'PA', 'RGB', 'RGBA'

    colors_used = len(img.getcolors(maxcolors=257))

    return {
        'mode': mode,
        'colors': colors_used,
        'indexed': mode in ['P', 'PA'],
        'can_optimize': mode in ['RGB', 'RGBA'] and colors_used <= 256
    }
```

### Step 2: Categorize Result

| Mode | Colors Used | Status | Action |
|------|-------------|--------|--------|
| P or PA | ≤256 | ✅ Optimal | None needed |
| RGB or RGBA | ≤256 | ⚠️ Suboptimal | Convert to indexed |
| RGB or RGBA | >256 | ❌ Invalid | Regenerate with palette constraint |

### Step 3: Report Findings

**Good Example** (VGA-compliant, optimized):
```
File: seelie_groves-scryer.png
Mode: P (Indexed/Palette)
Colors: 10
Status: ✅ Optimal — VGA-compliant + efficient storage
```

**Optimization Opportunity** (VGA-compliant, but inefficient):
```
File: ironroot-holdings-backdrop.png
Mode: RGBA
Colors: 16
Status: ⚠️ Suboptimal — VGA-compliant colors in RGB mode
Action: Convert to indexed (expect 25-30% size reduction)
```

**Compliance Failure** (too many colors):
```
File: map-base.png
Mode: RGBA
Colors: 286
Status: ❌ Invalid — Exceeds 256-color VGA limit
Action: Regenerate with stricter palette constraint
```

## Conversion Workflow

### RGB → Indexed Color Conversion

**Using Aseprite CLI**:
```bash
aseprite -b input.png \
  --palette land_palette.pal \
  --color-mode indexed \
  --save-as output.png
```

**Using ImageMagick**:
```bash
# Automatic quantization to 256 colors
mogrify -type Palette input.png

# With specific palette
convert input.png -remap palette.png output.png
```

**Using Python (Pillow)**:
```python
from PIL import Image

def convert_to_indexed(input_path, output_path, palette_image_path=None):
    img = Image.open(input_path)

    if palette_image_path:
        palette = Image.open(palette_image_path)
        img = img.quantize(palette=palette)
    else:
        img = img.quantize(colors=256)

    img.save(output_path)
```

## Quality Validation After Conversion

**Critical**: Always validate that indexed conversion preserved visual quality:

1. **Visual comparison**: Side-by-side original vs converted
2. **Color count verification**: Should be ≤256 after conversion
3. **Transparency check**: Alpha channel preserved (use PA mode if needed)
4. **File size check**: Should be 20-40% smaller

**If quality degraded**:
- Source image may have used >256 colors (check original)
- Conversion palette may not match source colors (use explicit palette)
- Dithering may have been added during conversion (disable if unwanted)

## Batch Validation Script

```bash
# Scan all PNGs and report color modes
find static/assets -name "*.png" -type f | while read file; do
  python scripts/validate_png_colormode.py "$file"
done

# Generate summary report
python scripts/validate_png_colormode.py static/assets --batch
```

**Expected Output**:
```
Color Mode Summary
==================

Total PNGs scanned: 545

Mode Distribution:
  P (Indexed):        10 files (1.8%)
  PA (Indexed+Alpha): 0 files (0%)
  RGB:                212 files (38.9%)
  RGBA:               323 files (59.3%)

Optimization Opportunities:
  Files using RGB/RGBA with ≤256 colors: 531 files
  Estimated size savings: 150-200KB (20-30% reduction)

Compliance Issues:
  Files exceeding 256 colors: 1 file (map-base.png: 286 colors)
```

## Integration with VGA Compliance

Color mode validation is **independent** of VGA compliance validation but they work together:

**Validation Order**:
1. **VGA Compliance Check** (validate_asset.py) — Ensures visual authenticity
   - Hard edges, appropriate dithering, palette values, etc.
   - **Blocking** for MVP launch

2. **Color Mode Check** (validate_png_colormode.py) — Ensures storage efficiency
   - Indexed vs RGB/RGBA mode
   - **Non-blocking** optimization opportunity

**Both passing**:
- ✅ VGA-compliant colors + Indexed mode = Perfect
- ✅ VGA-compliant colors + RGB mode = Good (optimize later)

**VGA failure**:
- ❌ Non-VGA colors (smooth gradients, anti-aliasing, etc.) = Regenerate
- Doesn't matter if indexed or RGB — visual quality is wrong

**Color mode failure**:
- ⚠️ RGB mode with ≤256 colors = Convert to indexed (optimization)
- ❌ RGB mode with >256 colors = Check if VGA-compliant first

## Common Misconceptions

### Myth 1: "RGB mode means it's not VGA-compliant"

**False**. RGB is a storage format. VGA compliance is about color **values** and visual aesthetic. An RGB-mode PNG can have perfect VGA-compliant colors — it's just storing them inefficiently.

### Myth 2: "I must convert to indexed before validating VGA compliance"

**False**. Run VGA compliance checks on RGB files first. If they fail, fix the visual issues before worrying about storage optimization.

### Myth 3: "Indexed color always looks worse"

**False** (for pixel art). If your source image already uses ≤256 colors, indexed conversion is lossless. You get identical visuals with smaller file size.

### Myth 4: "All VGA assets must be indexed"

**False**. Indexed is optimal, but RGB/RGBA files with VGA-compliant color values are acceptable for MVP. Optimization can happen post-launch.

## Tool Reference

### validate_png_colormode.py

**Purpose**: Scan PNGs and report color mode distribution

**Usage**:
```bash
# Single file
python scripts/validate_png_colormode.py path/to/file.png

# Batch scan directory
python scripts/validate_png_colormode.py path/to/directory --batch

# With summary report
python scripts/validate_png_colormode.py static/assets --batch --report
```

**Output**: Color mode, color count, optimization recommendations

### convert_to_indexed.py

**Purpose**: Batch convert RGB/RGBA → indexed color

**Usage**:
```bash
# Single file with auto-quantization
python scripts/convert_to_indexed.py input.png output.png

# Single file with specific palette
python scripts/convert_to_indexed.py input.png output.png --palette seelie_groves

# Batch convert directory
python scripts/convert_to_indexed.py static/assets --batch --palette ui_chrome
```

**Safety**: Always creates new files, never overwrites originals

## Post-MVP Optimization Strategy

**When to optimize**:
- After MVP launch (not blocking)
- During performance audit
- Before major release (file size matters for CDN)

**How to optimize**:
1. Run `validate_png_colormode.py --batch` to identify RGB/RGBA files
2. Filter for files with ≤256 colors (optimization candidates)
3. Batch convert using `convert_to_indexed.py` with appropriate palette
4. Validate conversions (visual quality + file size)
5. Deploy converted files

**Expected Impact**:
- 20-40% file size reduction for individual assets
- 150-250KB total savings across 545-asset inventory
- Zero visual quality loss (if done correctly)

---

*This validation is separate from VGA aesthetic compliance. Both are important, but serve different purposes: compliance ensures authenticity, color mode optimization ensures efficiency.*

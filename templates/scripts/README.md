# Limner Tools Reference

All tools are in the `tools/` directory, organized by function.

## Setup

```bash
# Create virtual environment (recommended)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## Pixel Art Tools (`tools/pixel_art/`)

### vga_validate.py — VGA Compliance Checker

Validates that an image meets VGA-era pixel art standards. Checks resolution scaling, pixel density, dithering patterns, color count, and anachronistic elements.

```bash
python tools/pixel_art/vga_validate.py image.png
python tools/pixel_art/vga_validate.py image.png --verbose
```

**Quality Gates**: Resolution score, pixel density, dither presence, color count ≤256, no modern lighting artifacts.

**Exit codes**: 0 = pass, 1 = fail

---

### palette_check.py — Palette Compliance Checker

Validates that an image's colors match a specific palette from the registry. Reports exact matches, near matches, and off-palette colors.

```bash
# Check against a specific palette
python tools/pixel_art/palette_check.py image.png --palette seelie_groves

# List available palettes
python tools/pixel_art/palette_check.py image.png --list-palettes

# Use custom palette config
python tools/pixel_art/palette_check.py image.png --palette my_palette --palette-config path/to/palettes.json
```

**Output**: Color-by-color breakdown with distance metrics. Near matches within threshold are acceptable.

---

### vga_normalize.py — VGA Post-Processing Pipeline

Applies VGA-style post-processing to images: palette mapping, dithering, scaling, outlines, and more. The most complex tool in the kit.

```bash
# Basic palette normalization
python tools/pixel_art/vga_normalize.py image.png --palette seelie_groves --stream clean

# Full pipeline with options
python tools/pixel_art/vga_normalize.py image.png \
    --palette seelie_groves \
    --stream hybrid \
    --dither floyd-steinberg \
    --outline dark \
    --outline-weight 1 \
    --target-width 128 \
    --output processed.png

# Use custom palette config
python tools/pixel_art/vga_normalize.py image.png --palette-config path/to/palettes.json
```

**Streams**: `clean` (icons/UI), `atmospheric` (scenes), `hybrid` (characters)

---

### png_validate.py — PNG Color Mode Validator

Batch-validates PNG files for color mode (RGB, Indexed, RGBA). Useful for identifying files that should be converted to indexed color for size savings.

```bash
python tools/pixel_art/png_validate.py path/to/assets/
python tools/pixel_art/png_validate.py path/to/assets/ --extensions .png .gif
```

---

## API Tools (`tools/api/`)

### retro_diffusion.py — Retro Diffusion API Client

Python client for the Retro Diffusion API. Handles authentication, palette enforcement, reference images, and all generation parameters.

```bash
# Check remaining credits
python tools/api/retro_diffusion.py --credits

# Generate an image
python tools/api/retro_diffusion.py \
    --prompt "medieval tavern interior, VGA pixel art" \
    --model rd_pro__fantasy \
    --width 256 --height 256 \
    --palette seelie_groves \
    --output tavern.png

# Use reference images
python tools/api/retro_diffusion.py \
    --prompt "elf character" \
    --ref-image reference.png \
    --palette-config path/to/palettes.json
```

**Requires**: `RD_API_TOKEN` environment variable or `--token` flag.

---

## Inventory Tools (`tools/inventory/`)

### asset_inventory.py — Manifest-Based Asset Checker

Compares deployed assets against a JSON manifest. Reports present, missing, and untracked files. Useful for ensuring all expected assets are deployed.

```bash
# Full inventory check
python tools/inventory/asset_inventory.py \
    --manifest examples/summoning_chamber_mvp/asset_manifest.json \
    --root /path/to/project

# Check specific category
python tools/inventory/asset_inventory.py \
    --manifest manifest.json \
    --root /path/to/project \
    --category ui
```

**Manifest format**: See `examples/summoning_chamber_mvp/asset_manifest.json` for the expected JSON structure.

---

### inventory_verify.py — Directory Scanner

Quick scan of an assets directory — reports file counts by category with subcategory breakdowns. No manifest needed; just tells you "what exists?"

```bash
# Basic scan
python tools/inventory/inventory_verify.py /path/to/assets

# Custom extensions
python tools/inventory/inventory_verify.py /path/to/assets --extensions .png .gif .jpg
```

---

## Configuration (`tools/config/`)

### palettes.json — Palette Registry

JSON file containing all palette definitions. Each palette entry includes:
- `name`: Display name
- `colors`: Array of `[R, G, B]` values
- `swatch`: Base64-encoded PNG swatch image

Referenced by `palette_check.py`, `vga_normalize.py`, and `retro_diffusion.py` via the `--palette-config` flag.

### Palette PNG Files

Individual swatch images for each palette. Used as reference by the Retro Diffusion API for palette enforcement during generation.

---

## Workflow Example

A typical asset generation + validation workflow:

```bash
# 1. Generate asset
python tools/api/retro_diffusion.py \
    --prompt "heraldic shield crest, oak tree, VGA pixel art" \
    --model rd_plus__classic \
    --palette seelie_groves \
    --output crest_raw.png

# 2. Post-process
python tools/pixel_art/vga_normalize.py crest_raw.png \
    --palette seelie_groves \
    --stream clean \
    --target-width 128 \
    --output crest_final.png

# 3. Validate
python tools/pixel_art/vga_validate.py crest_final.png
python tools/pixel_art/palette_check.py crest_final.png --palette seelie_groves

# 4. Verify deployment
python tools/inventory/inventory_verify.py path/to/deployed/assets
```

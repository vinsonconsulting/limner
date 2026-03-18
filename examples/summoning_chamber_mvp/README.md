# Summoning Chamber MVP — Limner Example Project

Reference implementation showing how Limner's tools were used to produce all visual assets for **Summoning Chamber**, a VGA-era pixel art RPG interface for assembling AI agents.

## Project Stats

- **10 Lands** (fantasy regions), each with unique palette + backdrop + crest
- **11 Classes** (agent archetypes), each with heraldic crest
- **110 character sprites** (Land × Class pairings)
- **~100 prop icons** (demeanor, nature, equipment, ambient)
- **256-color VGA** palette constraint throughout
- **Visual north star**: Darklands (1992)

## Directory Layout

```
examples/summoning_chamber_mvp/
├── README.md              ← You are here
├── asset_manifest.json    ← Expected assets for inventory checks
├── scripts/               ← 6 batch generation scripts (sc_ prefixed)
│   ├── sc_generate_backdrops.py
│   ├── sc_generate_class_crests.py
│   ├── sc_generate_crests.py
│   ├── sc_generate_frames.py
│   ├── sc_generate_master_scenes.py
│   └── sc_generate_overlays.py
├── docs/                  ← Art direction documentation
│   ├── LIMNER_BRIEF.md    ← Project brief + style guide
│   └── GENERATION_PATTERNS.md  ← Prompt engineering patterns
├── palettes/              ← Color palettes (JSON + PNG swatches)
│   ├── palettes.json      ← 11 palette definitions (10 Lands + ui_chrome)
│   └── *.png              ← Swatch images for API palette enforcement
└── sample_output/         ← Representative assets (5 categories)
    ├── seelie_groves-scryer.png       ← Scene composite
    ├── seelie-groves-crest.png        ← Land heraldic crest
    ├── ui-chrome-logo-small.png       ← UI chrome element
    ├── icon-demeanor-casual-mug.png   ← Prop icon
    └── character-elf-head.png         ← Character sprite part
```

## Generation Workflow

The Summoning Chamber asset pipeline follows a consistent pattern:

### 1. Generate Raw Image

```bash
# Using Retro Diffusion API (current)
python tools/api/retro_diffusion.py \
    --prompt "heraldic shield crest, oak tree, VGA pixel art" \
    --model rd_plus__classic \
    --palette seelie_groves \
    --palette-config examples/summoning_chamber_mvp/palettes/palettes.json \
    --output crest_raw.png
```

Or via batch script:
```bash
RD_API_TOKEN="..." python examples/summoning_chamber_mvp/scripts/sc_generate_crests.py
```

### 2. Post-Process (VGA Normalize)

```bash
python tools/pixel_art/vga_normalize.py crest_raw.png \
    --palette seelie_groves \
    --palette-config examples/summoning_chamber_mvp/palettes/palettes.json \
    --stream clean \
    --target-width 128 \
    --output crest_final.png
```

Streams: `clean` (icons/UI), `atmospheric` (scenes), `hybrid` (characters)

### 3. Validate

```bash
# VGA compliance (pixel density, dithering, color count)
python tools/pixel_art/vga_validate.py crest_final.png

# Palette compliance (color matching against Land palette)
python tools/pixel_art/palette_check.py crest_final.png \
    --palette seelie_groves \
    --palette-config examples/summoning_chamber_mvp/palettes/palettes.json

# Color mode check (RGB vs Indexed vs RGBA)
python tools/pixel_art/png_validate.py path/to/assets/
```

### 4. Verify Deployment

```bash
# Check all expected assets are present
python tools/inventory/asset_inventory.py \
    --manifest examples/summoning_chamber_mvp/asset_manifest.json \
    --root /path/to/summoning-chamber

# Quick directory scan
python tools/inventory/inventory_verify.py /path/to/summoning-chamber/static/assets
```

## Palette System

Each Land has a dedicated palette (8-24 colors) enforced at every stage:

| Palette | Land | Colors | Character |
|---------|------|--------|-----------|
| `seelie_groves` | Seelie Groves | 16 | Amber + silver forest tones |
| `freemark_reaches` | Freemark Reaches | 16 | Warm frontier earth tones |
| `ironroot_holdings` | Ironroot Holdings | 16 | Copper + cool stone |
| `shire_hearths` | Shire of Many Hearths | 16 | Golden warm domestics |
| `vaults_precieux` | Vaults of Precieux | 16 | Brass + ruby clockwork |
| `fenward_commons` | Fenward Commons | 16 | Misty swamp greens |
| `mire_grok` | Mire of Grok | 16 | Toxic bioluminescent |
| `scoria_warrens` | Scoria Warrens | 16 | Desert bronze + rust |
| `temple_frozen` | Temple of Frozen Thought | 16 | Crystalline blues |
| `bottomless_satchel` | Bottomless Satchel | 16 | Deep indigo + violet |
| `ui_chrome` | UI Elements | 8 | Neutral interface tones |

## Batch Scripts

The `sc_generate_*.py` scripts are project-specific batch runners. They import from Limner's `tools/` directory and handle:

- Prompt construction with Land-specific suffixes
- API rate limiting between generations
- Multi-stage pipeline (raw → normalize → upscale → deploy)
- Manifest generation for tracking outputs

Each script accepts `--only <id>` for single-item runs and `--skip-generate` to re-process existing raw files.

## Key Learnings

Documented in `docs/GENERATION_PATTERNS.md`:

- **"cozy" is banned** — triggers JRPG/anime aesthetics instead of VGA grit
- **Atmospheric suffix** works universally: `heavy chiaroscuro lighting, atmospheric perspective, deep shadows`
- **Resolution chain** for backdrops: 1820x1024 raw → 480x270 VGA → 1920x1080 display (nearest-neighbor 4x)
- **Chromakey technique** for overlays: generate at 1024x1024 with green screen, then composite
- **Background removal** (`remove_bg=True`) essential for icons and crests

## Adapting for Your Project

1. Copy this example directory as your starting point
2. Define your palettes in `palettes/palettes.json`
3. Write your project brief in `docs/` (use `templates/project_brief.md`)
4. Create batch scripts for your asset categories
5. Use `templates/session_log.md` to track generation sessions
6. Use `templates/asset_workbook.md` for budget and progress tracking

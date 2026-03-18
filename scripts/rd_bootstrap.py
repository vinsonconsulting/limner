#!/usr/bin/env python3
"""
rd_bootstrap.py — Summoning Chamber Retro Diffusion Bootstrap

Handles the full cold-start sequence:
  1. Generate palette PNGs (if missing)
  2. Create 3 custom styles on RD API
  3. Run 1 test generation per style to validate
  4. Save test outputs + style IDs

Run by Limner at the start of any new session where rd_style_ids.json
doesn't exist or styles need recreation.

Usage:
  export RD_API_KEY="your_key_here"
  python scripts/rd_bootstrap.py

  # Or pass key directly:
  python scripts/rd_bootstrap.py --key YOUR_API_KEY

  # Dry run (no API calls):
  python scripts/rd_bootstrap.py --dry-run

  # Skip style creation (already done), just test:
  python scripts/rd_bootstrap.py --test-only

  # Skip test generation, just create styles:
  python scripts/rd_bootstrap.py --styles-only

  # Recreate styles (delete + recreate):
  python scripts/rd_bootstrap.py --recreate
"""

import argparse
import base64
import json
import os
import sys
import time

import requests

try:
    import io

    from PIL import Image
except ImportError:
    print("ERROR: Requires Pillow — pip install Pillow")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════

API_BASE = "https://api.retrodiffusion.ai/v1"
STYLES_URL = f"{API_BASE}/styles"
INFER_URL = f"{API_BASE}/inferences"

PALETTE_DIR = "palettes"
TEST_OUTPUT_DIR = "test_output"
STYLE_IDS_FILE = "rd_style_ids.json"

# ═══════════════════════════════════════════════════════════════
# PALETTE DEFINITIONS (from vga_normalize.py / check_palette.py)
# ═══════════════════════════════════════════════════════════════

LAND_PALETTES = {
    "seelie": [
        (45, 90, 39), (25, 55, 20), (139, 105, 20), (80, 60, 12),
        (160, 160, 168), (100, 100, 108), (160, 120, 40), (20, 30, 15),
        (10, 12, 8),
    ],
    "freemark": [
        (160, 130, 72), (100, 80, 45), (112, 72, 35), (65, 42, 20),
        (150, 155, 165), (90, 95, 100), (140, 40, 30), (35, 28, 20),
        (15, 12, 10),
    ],
    "ironroot": [
        (85, 85, 85), (50, 50, 50), (60, 44, 32), (35, 25, 18),
        (150, 92, 40), (90, 55, 25), (140, 100, 30), (25, 25, 25),
        (12, 12, 12),
    ],
    "shire": [
        (60, 100, 72), (35, 60, 42), (180, 165, 130), (120, 110, 85),
        (180, 110, 0), (110, 68, 0), (160, 100, 30), (30, 25, 18),
        (12, 10, 8),
    ],
    "vaults": [
        (150, 110, 9), (90, 65, 5), (38, 38, 38), (20, 20, 20),
        (125, 14, 24), (75, 8, 14), (140, 90, 10), (15, 15, 18),
        (8, 8, 10),
    ],
    "fenward": [
        (60, 75, 28), (35, 45, 16), (74, 52, 41), (42, 30, 24),
        (165, 96, 28), (100, 58, 16), (140, 85, 20), (22, 25, 15),
        (10, 12, 8),
    ],
    "mire": [
        (80, 170, 0), (45, 95, 0), (22, 22, 22), (10, 10, 10),
        (175, 16, 48), (100, 10, 28), (160, 150, 130), (95, 88, 75),
        (12, 15, 8),
    ],
    "scoria": [
        (170, 145, 110), (100, 85, 65), (148, 52, 11), (88, 30, 6),
        (165, 102, 40), (98, 60, 24), (60, 130, 120), (35, 28, 20),
        (15, 12, 10),
    ],
    "temple": [
        (108, 165, 188), (62, 95, 110), (200, 200, 205), (140, 140, 148),
        (20, 20, 90), (12, 12, 55), (18, 20, 30), (8, 8, 15),
    ],
    "satchel": [
        (60, 0, 105), (35, 0, 60), (8, 6, 12), (2, 2, 4),
        (120, 0, 170), (70, 0, 100), (140, 100, 180), (15, 8, 22),
    ],
}

UI_PALETTE = [
    (12, 12, 12), (25, 22, 18), (40, 35, 28), (55, 48, 38),
    (75, 65, 50), (95, 82, 62), (120, 105, 80), (145, 128, 98),
    (165, 148, 115), (185, 170, 135), (200, 185, 155), (140, 40, 30),
    (100, 28, 20), (160, 120, 40), (90, 68, 22), (150, 155, 165),
    (90, 95, 100), (50, 50, 55), (30, 30, 35),
]


# ═══════════════════════════════════════════════════════════════
# STYLE DEFINITIONS
# ═══════════════════════════════════════════════════════════════

STYLE_DEFS = {
    "sc_atmospheric": {
        "name": "SC Atmospheric",
        "description": "Stream A: Darklands backgrounds, environments, maps. Heavy dithering, atmospheric depth, dark medieval.",
        "style_icon": "castle",
        "apply_prompt_fixer": True,
        "llm_instructions": (
            "Generate dark medieval pixel art with heavy Floyd-Steinberg dithering "
            "for depth and atmosphere. Use atmospheric perspective: distant elements "
            "darker and hazier, foreground elements slightly clearer. Practical light "
            "sources ONLY: candles, hearths, torches, forge glow, filtered daylight "
            "through leaves or windows. NO modern lighting, NO bloom, NO point lights, "
            "NO lens flare. Palette must feel weathered, muted, and grim — like a "
            "faded illuminated manuscript. Think 1992 Darklands DOS game. Colors are "
            "earth tones: deep browns, forest greens, steel greys, candlelight yellows. "
            "Suppress all saturation. Material textures through dithering patterns: "
            "stone looks like stone, wood like wood. NO smooth gradients, NO anti-aliasing, "
            "NO photo-realism."
        ),
        "user_prompt_template": (
            "Dark medieval pixel art scene: {prompt}, "
            "heavy atmospheric dithering, deep chiaroscuro shadows, "
            "weathered muted earth tones, grim medieval atmosphere, "
            "practical warm lighting, material texture through dithering"
        ),
        "force_palette": False,
        "force_bg_removal": False,
        "min_width": 128,
        "min_height": 128,
    },
    "sc_clean": {
        "name": "SC Clean",
        "description": "Stream B: CT-influenced characters, equipment, props, crests. Zero dithering, strong outlines, flat clusters.",
        "style_icon": "swordman",
        "apply_prompt_fixer": True,
        "llm_instructions": (
            "Generate clean pixel art sprites with ZERO dithering anywhere on the "
            "subject. Use large flat color clusters: 4-8 distinct colors per body "
            "region (skin, clothing, armor, hair). Every sprite MUST have a strong "
            "1-pixel outline in the darkest shade of each local color — NOT pure "
            "black. Silhouettes must be instantly recognizable at 50%% scale. Faces "
            "need expressive eyes using just 2-4 well-placed pixels. Colors are dark "
            "and muted: weathered medieval, NOT bright fantasy. Think Chrono Trigger "
            "sprite clarity but with a Darklands color palette — clean rendering, "
            "grim tones. Proportions should be slightly stylized (large heads, "
            "expressive poses). NO smooth gradients, NO anti-aliasing, NO dithering "
            "on skin or clothing. Shadow areas use a single darker flat tone, not "
            "dithered transitions."
        ),
        "user_prompt_template": (
            "Clean pixel art sprite: {prompt}, "
            "strong dark outlines, flat color clusters, zero dithering, "
            "muted dark medieval palette, clear silhouette, "
            "front-facing view"
        ),
        "force_palette": False,
        "force_bg_removal": True,
        "min_width": 96,
        "min_height": 96,
    },
    "sc_hybrid": {
        "name": "SC Hybrid",
        "description": "Stream C: Hillsfar UI chrome, furniture, large props. Light surface dithering, contextual outlines, manuscript feel.",
        "style_icon": "castle",
        "apply_prompt_fixer": True,
        "llm_instructions": (
            "Generate pixel art UI elements and functional props with light dithering "
            "ONLY on material surfaces: wood grain, stone texture, hammered metal, "
            "leather. Flat areas (background fill, panel interiors) should remain "
            "un-dithered. Outlines should be contextual: colored to match the material "
            "(brown for wood, grey for stone, copper for metal), NOT uniform black. "
            "Elements must feel handcrafted and medieval, like decorations from an "
            "illuminated manuscript or a Darklands menu screen. Clean functional edges "
            "where UI elements need to tile or align. Dark palette throughout: this is "
            "grim DOS-era interface chrome, not modern flat design. Think carved oak "
            "frames, hammered bronze corner pieces, aged parchment fills. NO smooth "
            "gradients, NO anti-aliasing, NO modern UI aesthetics."
        ),
        "user_prompt_template": (
            "Dark medieval pixel art: {prompt}, "
            "light material texture dithering, contextual colored outlines, "
            "functional detail, handcrafted manuscript aesthetic, "
            "weathered grim atmosphere"
        ),
        "force_palette": False,
        "force_bg_removal": False,
        "min_width": 96,
        "min_height": 96,
    },
}

# ═══════════════════════════════════════════════════════════════
# TEST GENERATION DEFINITIONS (one per style)
# ═══════════════════════════════════════════════════════════════

TEST_GENERATIONS = {
    "sc_atmospheric": {
        "prompt": "Castle library interior, tall bookshelves, candlelight, stone walls, wooden reading desk",
        "width": 192,
        "height": 128,
        "palette": "ui",
        "filename": "test_atmospheric_library.png",
    },
    "sc_clean": {
        "prompt": "Elf character, angular features, pointed ears, silver circlet, green hood, amber eyes, medieval fantasy warrior",
        "width": 128,
        "height": 192,
        "palette": "seelie",
        "filename": "test_clean_elf.png",
    },
    "sc_hybrid": {
        "prompt": "Ornate wooden panel frame with hammered bronze corner pieces, aged parchment center, medieval UI border",
        "width": 128,
        "height": 128,
        "palette": "ui",
        "filename": "test_hybrid_panel.png",
    },
}


# ═══════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def palette_to_png_bytes(colors):
    """Create a 1-pixel-tall palette strip PNG, return as bytes."""
    img = Image.new("RGB", (len(colors), 1))
    for i, color in enumerate(colors):
        img.putpixel((i, 0), color)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def palette_to_base64(palette_name):
    """Get a palette as base64-encoded PNG string."""
    if palette_name == "ui":
        colors = UI_PALETTE
    elif palette_name in LAND_PALETTES:
        colors = LAND_PALETTES[palette_name]
    else:
        raise ValueError(f"Unknown palette: {palette_name}")
    png_bytes = palette_to_png_bytes(colors)
    return base64.b64encode(png_bytes).decode("utf-8")


def ensure_palette_pngs():
    """Generate palette PNG files if they don't exist."""
    os.makedirs(PALETTE_DIR, exist_ok=True)
    generated = 0
    for name, colors in LAND_PALETTES.items():
        path = os.path.join(PALETTE_DIR, f"pal_{name}.png")
        if not os.path.exists(path):
            img = Image.new("RGB", (len(colors), 1))
            for i, c in enumerate(colors):
                img.putpixel((i, 0), c)
            img.save(path, "PNG")
            generated += 1
    # UI palette
    ui_path = os.path.join(PALETTE_DIR, "pal_ui.png")
    if not os.path.exists(ui_path):
        img = Image.new("RGB", (len(UI_PALETTE), 1))
        for i, c in enumerate(UI_PALETTE):
            img.putpixel((i, 0), c)
        img.save(ui_path, "PNG")
        generated += 1
    return generated


def save_base64_image(b64_string, filepath):
    """Decode a base64 image and save to disk."""
    img_bytes = base64.b64decode(b64_string)
    with open(filepath, "wb") as f:
        f.write(img_bytes)


def load_style_ids():
    """Load existing style IDs from JSON file."""
    if os.path.exists(STYLE_IDS_FILE):
        with open(STYLE_IDS_FILE) as f:
            return json.load(f)
    return {}


def save_style_ids(ids):
    """Save style IDs to JSON file."""
    with open(STYLE_IDS_FILE, "w") as f:
        json.dump(ids, f, indent=2)


# ═══════════════════════════════════════════════════════════════
# API FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def create_style(api_key, key, style_def, dry_run=False):
    """Create a single custom style. Returns prompt_style ID or None."""
    print(f"  POST {STYLES_URL}")
    print(f"  Name: {style_def['name']}")
    print(f"  BG removal: {style_def['force_bg_removal']}")
    print(f"  Min size: {style_def['min_width']}x{style_def['min_height']}")

    if dry_run:
        print("  [DRY RUN] Would create style")
        return f"DRYRUN__{key}"

    headers = {"X-RD-Token": api_key}
    resp = requests.post(STYLES_URL, headers=headers, json=style_def)

    if resp.status_code != 200:
        print(f"  ✗ HTTP {resp.status_code}: {resp.text[:300]}")
        return None

    data = resp.json()
    prompt_style = data.get("prompt_style")
    internal_id = data.get("id", "unknown")

    if prompt_style:
        print(f"  ✓ prompt_style: {prompt_style}")
        print(f"    internal_id:  {internal_id}")
        return prompt_style
    else:
        print(f"  ✗ No prompt_style in response: {json.dumps(data)[:300]}")
        return None


def delete_style(api_key, style_id):
    """Delete a style by its prompt_style ID."""
    url = f"{STYLES_URL}/{style_id}"
    headers = {"X-RD-Token": api_key}
    resp = requests.delete(url, headers=headers)
    if resp.status_code == 200:
        print(f"  ✓ Deleted: {style_id}")
        return True
    else:
        print(f"  ✗ Delete failed ({resp.status_code}): {resp.text[:200]}")
        return False


def test_generate(api_key, prompt_style, test_def, dry_run=False):
    """Run one test generation. Returns filename or None."""
    palette_b64 = palette_to_base64(test_def["palette"])

    payload = {
        "prompt": test_def["prompt"],
        "width": test_def["width"],
        "height": test_def["height"],
        "num_images": 1,
        "prompt_style": prompt_style,
        "input_palette": palette_b64,
        "seed": 1992,
    }

    print(f"  POST {INFER_URL}")
    print(f"  Prompt: {test_def['prompt'][:80]}...")
    print(f"  Size: {test_def['width']}x{test_def['height']}")
    print(f"  Palette: {test_def['palette']} ({len(palette_b64)} chars b64)")

    if dry_run:
        print("  [DRY RUN] Would generate image")
        return None

    headers = {"X-RD-Token": api_key}
    resp = requests.post(INFER_URL, headers=headers, json=payload)

    if resp.status_code != 200:
        print(f"  ✗ HTTP {resp.status_code}: {resp.text[:300]}")
        return None

    data = resp.json()
    cost = data.get("balance_cost", "?")
    remaining = data.get("remaining_balance", "?")
    images = data.get("base64_images", [])

    print(f"  Cost: ${cost} (remaining: ${remaining})")

    if not images:
        print("  ✗ No images in response")
        return None

    os.makedirs(TEST_OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(TEST_OUTPUT_DIR, test_def["filename"])
    save_base64_image(images[0], filepath)
    print(f"  ✓ Saved: {filepath}")
    return filepath


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Bootstrap Retro Diffusion for Summoning Chamber",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                    # Full bootstrap: palettes + styles + test
  %(prog)s --dry-run          # Preview without API calls
  %(prog)s --styles-only      # Create styles, skip test generation
  %(prog)s --test-only        # Test generation only (styles must exist)
  %(prog)s --recreate         # Delete existing styles + recreate
        """,
    )
    parser.add_argument("--key", help="RD API key (or set RD_API_KEY env var)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without API calls")
    parser.add_argument("--styles-only", action="store_true", help="Create styles, skip test")
    parser.add_argument("--test-only", action="store_true", help="Test only (styles must exist)")
    parser.add_argument("--recreate", action="store_true", help="Delete + recreate styles")
    args = parser.parse_args()

    api_key = args.key or os.environ.get("RD_API_KEY")
    if not api_key and not args.dry_run:
        print("ERROR: Provide API key via --key or RD_API_KEY env var")
        print("  Get yours at https://www.retrodiffusion.ai/app/devtools")
        sys.exit(1)

    print()
    print("=" * 64)
    print("  SUMMONING CHAMBER — Retro Diffusion Bootstrap")
    print("=" * 64)
    print()

    # ─── Step 1: Palette PNGs ───
    print("─── Step 1: Palette PNGs ───")
    generated = ensure_palette_pngs()
    total = len(LAND_PALETTES) + 1
    if generated > 0:
        print(f"  Generated {generated} new palette PNGs in {PALETTE_DIR}/")
    else:
        print(f"  All {total} palette PNGs already exist in {PALETTE_DIR}/")
    print()

    # ─── Step 2: Create Styles ───
    style_ids = load_style_ids()

    if not args.test_only:
        print("─── Step 2: Create Custom Styles ───")

        if args.recreate and style_ids:
            print("  Deleting existing styles...")
            for key, sid in style_ids.items():
                if sid and not sid.startswith("DRYRUN"):
                    delete_style(api_key, sid)
            style_ids = {}
            print()

        for key, style_def in STYLE_DEFS.items():
            if key in style_ids and style_ids[key] and not style_ids[key].startswith("DRYRUN"):
                print(f"[{key}] Already exists: {style_ids[key]}")
                print()
                continue

            print(f"[{key}] Creating...")
            prompt_style = create_style(api_key, key, style_def, dry_run=args.dry_run)
            if prompt_style:
                style_ids[key] = prompt_style
            else:
                style_ids[key] = None
                print("  ⚠ Style creation failed — will skip test for this style")
            print()

            # Brief pause between API calls
            if not args.dry_run:
                time.sleep(1)

        save_style_ids(style_ids)
        print(f"  Style IDs saved to {STYLE_IDS_FILE}")
        print()
    else:
        print("─── Step 2: Skipped (--test-only) ───")
        if not style_ids:
            print(f"  ERROR: No {STYLE_IDS_FILE} found. Run without --test-only first.")
            sys.exit(1)
        print(f"  Loaded {len(style_ids)} style IDs from {STYLE_IDS_FILE}")
        print()

    # ─── Step 3: Test Generations ───
    if not args.styles_only:
        print("─── Step 3: Test Generations (1 per style) ───")
        test_results = {}

        for key, test_def in TEST_GENERATIONS.items():
            prompt_style = style_ids.get(key)
            if not prompt_style or prompt_style.startswith("DRYRUN"):
                print(f"[{key}] Skipping — no valid style ID")
                test_results[key] = None
                print()
                continue

            print(f"[{key}] Generating test image...")
            filepath = test_generate(api_key, prompt_style, test_def, dry_run=args.dry_run)
            test_results[key] = filepath
            print()

            if not args.dry_run:
                time.sleep(2)

        print()
    else:
        print("─── Step 3: Skipped (--styles-only) ───")
        test_results = {}
        print()

    # ─── Summary ───
    print("=" * 64)
    print("  BOOTSTRAP COMPLETE")
    print("=" * 64)
    print()

    print("  Custom Style IDs:")
    print("  ┌─────────────────┬─────────────────────────────────────┐")
    print("  │ Stream          │ prompt_style                        │")
    print("  ├─────────────────┼─────────────────────────────────────┤")
    for key in ["sc_atmospheric", "sc_clean", "sc_hybrid"]:
        sid = style_ids.get(key, "NOT CREATED")
        stream = {"sc_atmospheric": "A (backgrounds)", "sc_clean": "B (sprites)", "sc_hybrid": "C (UI chrome)"}[key]
        status = "✓" if sid and not sid.startswith("DRYRUN") else "✗"
        print(f"  │ {status} {stream:<13} │ {str(sid):<35} │")
    print("  └─────────────────┴─────────────────────────────────────┘")
    print()

    if test_results:
        print("  Test Outputs:")
        for key, path in test_results.items():
            status = "✓" if path else "✗"
            print(f"    {status} {key}: {path or 'FAILED/SKIPPED'}")
        print()

    print(f"  Style IDs file: {STYLE_IDS_FILE}")
    print(f"  Palette PNGs:   {PALETTE_DIR}/")
    if test_results:
        print(f"  Test outputs:   {TEST_OUTPUT_DIR}/")
    print()

    # ─── Markdown table for docs ───
    valid = {k: v for k, v in style_ids.items() if v and not v.startswith("DRYRUN")}
    if valid:
        print("  ── Copy into Limner docs ──")
        print()
        print("  | Stream | Key | prompt_style |")
        print("  |--------|-----|-------------|")
        for key in ["sc_atmospheric", "sc_clean", "sc_hybrid"]:
            if key in valid:
                stream = {"sc_atmospheric": "A (atmospheric)", "sc_clean": "B (clean)", "sc_hybrid": "C (hybrid)"}[key]
                print(f"  | {stream} | {key} | `{valid[key]}` |")
        print()

    # ─── Next steps ───
    print("  NEXT STEPS:")
    if test_results:
        print("  1. Review test images in test_output/")
        print("  2. If quality is wrong, adjust LLM instructions via PATCH")
        print("  3. If quality is good, begin Sprint 1 production")
    else:
        print("  1. Run without --styles-only to generate test images")
        print("  2. Review test outputs before production")
    print()
    print("  To add reference images later:")
    print("    PATCH /v1/styles/{style_id}")
    print('    {"reference_images": ["base64_png..."]}')
    print()


if __name__ == "__main__":
    main()

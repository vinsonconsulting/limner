#!/usr/bin/env python3
"""
Batch Class Furniture Overlay generation via Recraft API + vga_normalize pipeline.

Generates all 11 Class overlays:
  1. Recraft API (hillsfar_furniture style_id) → 1820×1024 raw on chromakey green
  2. Crop text panel (Hillsfar UI gibberish)
  3. Key out green/cyan + black backgrounds → transparent PNG
  4. vga_normalize → 480×143 (hybrid stream, ui_chrome palette)
  5. Compose onto 480×270 transparent canvas (items in lower portion)
  6. Pillow nearest-neighbor 4× → 1920×1080

Usage:
  RECRAFT_API_TOKEN="..." python3 scripts/generate_overlays.py
  RECRAFT_API_TOKEN="..." python3 scripts/generate_overlays.py --only magister
  RECRAFT_API_TOKEN="..." python3 scripts/generate_overlays.py --skip-generate
  RECRAFT_API_TOKEN="..." python3 scripts/generate_overlays.py --deploy
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    import httpx
    import numpy as np
    from PIL import Image
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("pip3 install Pillow numpy httpx")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

STYLE_ID = "5f8386cc-c18a-494b-ac71-ae6d69096be6"  # hillsfar_furniture
GRIM_SUFFIX = "weathered texture, muted earth tones, grim atmosphere, medieval authentic"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "test-generations" / "overlays"
NORMALIZE_SCRIPT = PROJECT_ROOT / "scripts" / "vga_normalize.py"
DEPLOY_DIR = PROJECT_ROOT / "static" / "assets" / "classes"

# Resolution chain: 1820×1024 raw → crop → key → 480×143 VGA → 480×270 canvas → 1920×1080
RAW_SIZE = "1820x1024"
VGA_WIDTH = 480
CANVAS_SIZE = (480, 270)
UPSCALE_FACTOR = 4     # 480×4 = 1920, 270×4 = 1080
BOTTOM_MARGIN = 20     # pixels from bottom of canvas for furniture baseline


# ---------------------------------------------------------------------------
# Class Definitions
# ---------------------------------------------------------------------------

CLASSES = [
    {
        "id": "scryer",
        "name": "Scryer",
        "environment": "Gazing Pool",
        "prompt": (
            "medieval gazing pool chamber furniture on solid bright green chromakey background, "
            "large ornate scrying basin on stone pedestal center, crystal ball on tall wooden stand left, "
            "small table with star charts and astronomical instruments right, "
            "hanging mirror frame far right, scattered crystals on floor, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "magister",
        "name": "Magister",
        "environment": "Castle Library",
        "prompt": (
            "medieval castle library furniture on solid bright green chromakey background, "
            "large bookshelf filled with leather tomes far left, "
            "heavy writing desk with open leather book candle ink pot center, "
            "tall ornate floor candelabra with lit candles right of center, "
            "small reading lectern with scroll far right, stacked books on floor, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "hammerer",
        "name": "Hammerer",
        "environment": "Workshop",
        "prompt": (
            "medieval blacksmith workshop furniture on solid bright green chromakey background, "
            "large iron anvil on oak stump center, brick forge furnace with bellows far left, "
            "wooden tool rack with hammers tongs far right, workbench with metal pieces right, "
            "bucket of water and coal pile on floor, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "craftsman",
        "name": "Craftsman",
        "environment": "Artisan Studio",
        "prompt": (
            "medieval artisan studio furniture on solid bright green chromakey background, "
            "wooden easel with canvas center-left, pottery wheel on low table center-right, "
            "display shelf with finished ceramic works far right, "
            "wooden tool cabinet with brushes and chisels far left, paint pots on floor, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "diplomat",
        "name": "Diplomat",
        "environment": "Long Table",
        "prompt": (
            "medieval diplomatic chamber furniture on solid bright green chromakey background, "
            "long heavy oak table center spanning most of width, six ornate wooden chairs around table, "
            "rolled maps and sealed documents on table surface, "
            "wax seal stamp and candle on table corner, large banner standard far left, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "herald",
        "name": "Herald",
        "environment": "Speaking Platform",
        "prompt": (
            "medieval speaking platform furniture on solid bright green chromakey background, "
            "raised wooden podium with carved front center, tall banner standard with heraldic device left, "
            "large brass horn on stand right of podium, "
            "wooden benches for audience far left and far right, torch bracket on post, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "warden",
        "name": "Warden",
        "environment": "Crossroads",
        "prompt": (
            "medieval crossroads checkpoint furniture on solid bright green chromakey background, "
            "tall wooden signpost with multiple direction signs center, "
            "wooden barrier gate with iron hinges left, "
            "iron lantern on tall post right, small guard booth with desk far right, "
            "road stones and milestone marker on floor, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "counselor",
        "name": "Counselor",
        "environment": "Study",
        "prompt": (
            "medieval private study furniture on solid bright green chromakey background, "
            "two cushioned armchairs facing each other center-left and center-right, "
            "small round tea table with teapot and cups between chairs, "
            "stone fireplace mantel with clock far right, bookshelf corner far left, "
            "thick carpet rug on floor, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "merchant",
        "name": "Merchant",
        "environment": "Merchant Shop",
        "prompt": (
            "medieval merchant shop furniture on solid bright green chromakey background, "
            "wooden shop counter with brass scales center, glass display case left, "
            "shelves of goods and wares far left, iron strongbox lockbox right, "
            "hanging lantern above counter, coin purse and ledger on counter, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "seneschal",
        "name": "Seneschal",
        "environment": "Commander Tent",
        "prompt": (
            "medieval commander war tent furniture on solid bright green chromakey background, "
            "large war table with unrolled campaign map center, "
            "wooden miniature battle markers on map, tall flag standard far left, "
            "document chest with scrolls right, armor stand with plate armor far right, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
    {
        "id": "bard",
        "name": "Bard",
        "environment": "Tavern",
        "prompt": (
            "medieval tavern performance furniture on solid bright green chromakey background, "
            "small raised wooden stage platform center-left, lute on stand on stage, "
            "wooden stool on stage, tavern bar counter far right with mugs and barrels, "
            "audience bench far left, hanging oil lantern, "
            "items arranged with natural spacing as if in a room, all grounded on same baseline, "
        ),
    },
]


# ---------------------------------------------------------------------------
# Pipeline Functions
# ---------------------------------------------------------------------------

def generate_raw(client: httpx.Client, cls: dict) -> Path:
    """Generate 1820×1024 raw overlay via Recraft API on chromakey green."""
    raw_path = OUTPUT_DIR / f"{cls['id']}_raw.png"

    prompt = f"{cls['prompt']}{GRIM_SUFFIX}"

    print(f"  Generating: {cls['name']} ({cls['environment']})...")
    print(f"  Prompt: {prompt[:120]}...")

    response = client.post(
        "https://external.api.recraft.ai/v1/images/generations",
        json={
            "prompt": prompt,
            "style_id": STYLE_ID,
            "model": "recraftv3",
            "size": RAW_SIZE,
        },
    )
    response.raise_for_status()
    result = response.json()
    image_url = result["data"][0]["url"]

    img_response = client.get(image_url, timeout=60.0)
    raw_path.write_bytes(img_response.content)
    print(f"  -> Raw: {raw_path.name} ({len(img_response.content)} bytes)")
    return raw_path


def crop_text_panel(raw_path: Path) -> Image.Image:
    """Crop the Hillsfar UI text panel from the bottom of the image.

    Scans from bottom upward, only in the lower 60% of the image,
    looking for the separator bar (red/yellow/orange horizontal line)
    that sits above the text panel. Also detects the ornate border
    frame that sometimes wraps the text area.
    """
    img = Image.open(raw_path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]

    # Only search in the lower 60% of image (text panel is always at bottom)
    search_start = int(h * 0.40)

    # Strategy 1: Find horizontal separator bar scanning from bottom up
    # The separator is a red/yellow/orange line spanning >25% of width
    crop_y = h  # Default: no crop

    # Look for the TOP edge of the text panel area by scanning upward
    # We want the highest separator bar in the bottom portion
    best_separator_y = h
    for y in range(h - 1, search_start, -1):
        row = arr[y]
        r, g, b = row[:, 0].astype(int), row[:, 1].astype(int), row[:, 2].astype(int)

        # Red bar pixels
        red_mask = (r > 180) & (g < 100) & (b < 100)
        # Yellow bar pixels
        yellow_mask = (r > 180) & (g > 150) & (b < 100)
        # Orange bar pixels
        orange_mask = (r > 160) & (g > 80) & (g < 160) & (b < 80)
        sep_pixels = np.sum(red_mask | yellow_mask | orange_mask)

        if sep_pixels > w * 0.25:
            best_separator_y = y
            # Keep scanning upward to find the topmost separator line
            continue
        elif best_separator_y < h and sep_pixels < w * 0.05:
            # We've passed above the separator region
            break

    if best_separator_y < h:
        crop_y = max(0, best_separator_y - 2)
        print(f"  -> Text panel separator at y={best_separator_y}, cropping to {crop_y}")

    # Strategy 2: Find ornate border frame (diamond pattern row)
    if crop_y == h:
        for y in range(h - 1, search_start, -1):
            row = arr[y]
            r, g, b = row[:, 0].astype(int), row[:, 1].astype(int), row[:, 2].astype(int)
            # Ornate border: high contrast pattern (alternating light/dark)
            brightness = r + g + b
            # Check if this row is mostly very dark (text background)
            dark_pct = np.sum(brightness < 80) / w
            if dark_pct > 0.7:
                # Found a mostly-dark row — this is likely text area
                # Keep scanning up to find the top edge
                continue
            elif dark_pct < 0.3 and y < best_separator_y:
                # Transition from dark text area to lighter scene
                crop_y = y + 5  # Add small margin
                print(f"  -> Text area top edge at y={y}, cropping to {crop_y}")
                break

    if crop_y == h:
        # Fallback: use 65% of image height (more conservative than before)
        crop_y = int(h * 0.65)
        print(f"  -> No separator found, fallback crop at y={crop_y}")

    return img.crop((0, 0, w, crop_y))


def key_out_background(img: Image.Image) -> Image.Image:
    """Remove green/cyan chromakey background, leaving furniture on transparent.

    Conservative approach — only keys out clear chromakey colors (green, cyan,
    teal) and pure black. Does NOT attempt to remove gray walls or border
    frames, since those heuristics destroy gray-toned furniture items.
    """
    arr = np.array(img)
    h, w = arr.shape[:2]
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)

    # 1. Green/cyan chromakey mask (broad — catches teal and lime too)
    green_mask = (g > 150) & (g > r + 40)
    teal_mask = (g > 180) & (b > 150) & (r < 100)
    # Bright cyan (Hillsfar windows)
    cyan_mask = (g > 200) & (b > 200) & (r < 100)

    # 2. Pure black mask (true black background only)
    black_mask = (r + g + b) < 20

    # 3. Combined background mask
    bg_mask = green_mask | teal_mask | cyan_mask | black_mask

    # Make matched pixels transparent
    arr[bg_mask, 3] = 0

    # 4. Clean up green fringe on remaining pixels (anti-aliasing edges)
    remaining = arr[:, :, 3] > 0
    fringe_mask = remaining & (g > 120) & (g > r + 30) & (g > b + 20)
    arr[fringe_mask, 3] = 0

    total = h * w
    transparent = np.sum(arr[:, :, 3] == 0)
    pct = transparent / total * 100
    print(f"  -> Keyed: {transparent}/{total} transparent ({pct:.1f}%)")

    # Warn if very low transparency (chromakey probably wasn't used)
    if pct < 20:
        print(f"  !! WARNING: Low transparency ({pct:.1f}%) — chromakey green likely missing")
        print("     Consider re-generating with stronger green background prompt")

    return Image.fromarray(arr)


def normalize(keyed_path: Path, cls: dict) -> Path:
    """Run vga_normalize → hybrid stream, ui_chrome palette."""
    vga_path = OUTPUT_DIR / f"{cls['id']}_vga.png"

    cmd = [
        sys.executable, str(NORMALIZE_SCRIPT),
        str(keyed_path),
        "-o", str(vga_path),
        "--stream", "hybrid",
        "--palette", "ui_chrome",
        "--target-width", str(VGA_WIDTH),
        "--dither", "none",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  !! Normalize FAILED: {result.stderr[:300]}")
        return None

    for line in result.stdout.split("\n"):
        if "Output:" in line or "colors" in line.lower():
            print(f"  -> VGA: {line.strip()}")

    return vga_path


def compose_and_upscale(vga_path: Path, cls: dict) -> Path:
    """Compose normalized overlay onto 480×270 canvas, then 4× upscale to 1920×1080."""
    final_path = OUTPUT_DIR / f"{cls['id']}_final.png"

    overlay = Image.open(vga_path).convert("RGBA")

    # Create transparent canvas matching backdrop VGA dimensions
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))

    # Center horizontally, ground near bottom
    x = (CANVAS_SIZE[0] - overlay.size[0]) // 2
    y = CANVAS_SIZE[1] - overlay.size[1] - BOTTOM_MARGIN

    canvas.paste(overlay, (x, max(0, y)), overlay)
    canvas.save(OUTPUT_DIR / f"{cls['id']}_canvas.png")

    # Nearest-neighbor 4× upscale
    target_w = CANVAS_SIZE[0] * UPSCALE_FACTOR
    target_h = CANVAS_SIZE[1] * UPSCALE_FACTOR
    upscaled = canvas.resize((target_w, target_h), Image.NEAREST)
    upscaled.save(final_path)

    size_kb = final_path.stat().st_size / 1024
    print(f"  -> Final: {target_w}x{target_h} ({size_kb:.1f} KB)")
    return final_path


def make_preview(final_path: Path, cls: dict) -> Path:
    """Composite overlay on a Land backdrop for visual preview."""
    preview_path = OUTPUT_DIR / f"{cls['id']}_preview.png"

    overlay = Image.open(final_path).convert("RGBA")

    # Try compositing on seelie-groves backdrop for neutral preview
    backdrop_path = PROJECT_ROOT / "static" / "assets" / "lands" / "seelie-groves" / "backdrop.png"
    if backdrop_path.exists():
        backdrop = Image.open(backdrop_path).convert("RGBA")
        backdrop.paste(overlay, (0, 0), overlay)
        backdrop.convert("RGB").save(preview_path)
    else:
        # Fallback: dark background
        dark = Image.new("RGBA", overlay.size, (20, 18, 15, 255))
        dark.paste(overlay, (0, 0), overlay)
        dark.convert("RGB").save(preview_path)

    return preview_path


def deploy(final_path: Path, cls: dict) -> Path:
    """Copy final overlay to static/assets/classes/{id}/overlay.png."""
    import shutil
    class_dir = DEPLOY_DIR / cls["id"]
    class_dir.mkdir(parents=True, exist_ok=True)
    deploy_path = class_dir / "overlay.png"

    shutil.copy2(final_path, deploy_path)
    print(f"  -> Deployed: {deploy_path.relative_to(PROJECT_ROOT)}")
    return deploy_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Batch Class Furniture Overlay generation")
    parser.add_argument("--only", help="Generate only this Class ID")
    parser.add_argument("--skip-generate", action="store_true",
                        help="Skip Recraft generation, process existing raw files")
    parser.add_argument("--deploy", action="store_true",
                        help="Deploy final assets to static/assets/classes/")
    parser.add_argument("--preview", action="store_true",
                        help="Generate composite preview images")
    args = parser.parse_args()

    token = os.environ.get("RECRAFT_API_TOKEN")
    if not token and not args.skip_generate:
        print("Error: RECRAFT_API_TOKEN not set")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Filter classes
    classes = CLASSES
    if args.only:
        classes = [c for c in CLASSES if c["id"] == args.only]
        if not classes:
            print(f"Unknown Class ID: {args.only}")
            print(f"Available: {', '.join(c['id'] for c in CLASSES)}")
            sys.exit(1)

    if not args.skip_generate:
        client = httpx.Client(
            headers={"Authorization": f"Bearer {token}"},
            timeout=120.0,
        )
    else:
        client = None

    results = []

    for i, cls in enumerate(classes):
        print(f"\n{'='*60}")
        print(f"[{i+1}/{len(classes)}] {cls['name']} — {cls['environment']} ({cls['id']})")
        print(f"{'='*60}")

        # Step 1: Generate raw (or use existing)
        raw_path = OUTPUT_DIR / f"{cls['id']}_raw.png"
        if args.skip_generate:
            if not raw_path.exists():
                print(f"  !! No raw file found: {raw_path}")
                continue
            print(f"  -> Using existing raw: {raw_path.name}")
        else:
            raw_path = generate_raw(client, cls)
            if i < len(classes) - 1:
                time.sleep(2)  # Rate limit pause

        # Step 2: Crop text panel
        cropped = crop_text_panel(raw_path)
        cropped_path = OUTPUT_DIR / f"{cls['id']}_cropped.png"
        cropped.save(cropped_path)
        print(f"  -> Cropped: {cropped.size[0]}x{cropped.size[1]}")

        # Step 3: Key out background
        keyed = key_out_background(cropped)
        keyed_path = OUTPUT_DIR / f"{cls['id']}_keyed.png"
        keyed.save(keyed_path)

        # Step 4: Normalize
        vga_path = normalize(keyed_path, cls)
        if not vga_path:
            continue

        # Step 5: Compose onto canvas and upscale
        final_path = compose_and_upscale(vga_path, cls)

        # Step 6: Preview (optional)
        preview_path = None
        if args.preview:
            preview_path = make_preview(final_path, cls)
            print(f"  -> Preview: {preview_path.name}")

        # Step 7: Deploy (if requested)
        deploy_path = None
        if args.deploy:
            deploy_path = deploy(final_path, cls)

        results.append({
            "id": cls["id"],
            "name": cls["name"],
            "environment": cls["environment"],
            "raw": str(raw_path),
            "keyed": str(keyed_path),
            "vga": str(vga_path),
            "final": str(final_path),
            "preview": str(preview_path) if preview_path else None,
            "deployed": str(deploy_path) if deploy_path else None,
        })

    if client:
        client.close()

    # Save manifest
    manifest_path = OUTPUT_DIR / "overlay_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n{'='*60}")
    print(f"Done! {len(results)} overlays processed.")
    print(f"Manifest: {manifest_path}")
    print(f"Review files in: {OUTPUT_DIR}")
    if not args.deploy:
        print("Run with --deploy to copy to static/assets/classes/")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

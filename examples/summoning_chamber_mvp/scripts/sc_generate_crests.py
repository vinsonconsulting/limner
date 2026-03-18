#!/usr/bin/env python3
"""
Batch crest generation via Recraft API + vga_normalize pipeline.

Generates all Land crests + Summoner's crest:
  1. Recraft API (ct_sprites style_id) → 1024×1024 raw
  2. Pillow crop to shield area (remove Celtic frame)
  3. Square on dark bg RGB(20,18,15)
  4. vga_normalize → 128×128 + 48×48

Usage:
  RECRAFT_API_TOKEN="..." python3 scripts/generate_crests.py
  RECRAFT_API_TOKEN="..." python3 scripts/generate_crests.py --only freemark-reaches
  RECRAFT_API_TOKEN="..." python3 scripts/generate_crests.py --skip-generate  # normalize only
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

# Pillow + httpx
try:
    import httpx
    from PIL import Image
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("pip3 install Pillow httpx")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

STYLE_ID = "88570f3e-ed04-4aa1-a70d-e50eb640cdb2"  # ct_sprites
GRIM_SUFFIX = "weathered texture, muted earth tones, grim atmosphere, medieval authentic"
DARK_BG = (20, 18, 15)

# Crop insets: percentage from each edge to cut the Celtic frame
CROP_LEFT = 0.20
CROP_TOP = 0.15
CROP_RIGHT = 0.80
CROP_BOTTOM = 0.88

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "test-generations" / "crests"
NORMALIZE_SCRIPT = PROJECT_ROOT / "scripts" / "vga_normalize.py"

CRESTS = [
    {
        "id": "freemark-reaches",
        "name": "Freemark Reaches",
        "palette": "freemark_reaches",
        "motif": "crossed sword and compass over a rising sun, steel blade and brass compass",
    },
    {
        "id": "ironroot-holdings",
        "name": "Ironroot Holdings",
        "palette": "ironroot_holdings",
        "motif": "heavy hammer and anvil beneath a tall redwood tree silhouette, stone and copper",
    },
    {
        "id": "shire-of-many-hearths",
        "name": "Shire of Many Hearths",
        "palette": "shire_hearths",
        "motif": "smoking stone chimney with a green welcome wreath hung on it, warm and cozy",
    },
    {
        "id": "vaults-of-precieux",
        "name": "Vaults of Précieux",
        "palette": "vaults_precieux",
        "motif": "interlocking clockwork gears forming a keyhole shape, brass and dark iron",
    },
    {
        "id": "fenward-commons",
        "name": "Fenward Commons",
        "palette": "fenward_commons",
        "motif": "two cattail reeds crossed over calm dark water, murky green wetland",
    },
    {
        "id": "mire-of-grok",
        "name": "Mire of Grok",
        "palette": "mire_grok",
        "motif": "tusked beast skull wreathed in thorny toxic vines, bone and poison green",
    },
    {
        "id": "scoria-warrens",
        "name": "Scoria Warrens",
        "palette": "scoria_warrens",
        "motif": "coiled serpent wrapped around a bronze sun disc, desert tan and aged bronze",
    },
    {
        "id": "temple-of-frozen-thought",
        "name": "Temple of Frozen Thought",
        "palette": "temple_frozen",
        "motif": "geometric snowflake containing a seated meditation figure, ice blue and white",
    },
    {
        "id": "bottomless-satchel",
        "name": "Bottomless Satchel",
        "palette": "bottomless_satchel",
        "motif": "swirling void portal with small fragments floating outward, deep purple and violet",
    },
    {
        "id": "summoner",
        "name": "Summoner's Crest",
        "palette": "ui_chrome",
        "motif": "heavy arched wooden door slightly ajar with warm golden light spilling from within, iron hinges",
    },
]


def generate_raw(client: httpx.Client, crest: dict) -> Path:
    """Generate 1024×1024 raw crest via Recraft API."""
    raw_path = OUTPUT_DIR / f"{crest['id']}_raw.png"

    prompt = (
        f"heraldic shield crest, {crest['motif']}, "
        f"centered on shield, {GRIM_SUFFIX}"
    )

    print(f"  Generating: {crest['name']}...")
    print(f"  Prompt: {prompt[:100]}...")

    response = client.post(
        "https://external.api.recraft.ai/v1/images/generations",
        json={
            "prompt": prompt,
            "style_id": STYLE_ID,
            "model": "recraftv3",
            "size": "1024x1024",
        },
    )
    response.raise_for_status()
    result = response.json()
    image_url = result["data"][0]["url"]

    # Download
    img_response = client.get(image_url, timeout=60.0)
    raw_path.write_bytes(img_response.content)
    print(f"  → Raw: {raw_path.name} ({len(img_response.content)} bytes)")
    return raw_path


def crop_and_square(raw_path: Path, crest: dict) -> Path:
    """Crop shield from Celtic frame, square on dark bg."""
    cropped_path = OUTPUT_DIR / f"{crest['id']}_cropped.png"

    img = Image.open(raw_path)
    w, h = img.size

    # Crop to shield area
    left = int(w * CROP_LEFT)
    top = int(h * CROP_TOP)
    right = int(w * CROP_RIGHT)
    bottom = int(h * CROP_BOTTOM)
    cropped = img.crop((left, top, right, bottom))

    # Square on dark background
    cw, ch = cropped.size
    side = max(cw, ch)
    square = Image.new("RGB", (side, side), DARK_BG)
    px = (side - cw) // 2
    py = (side - ch) // 2
    square.paste(cropped, (px, py))

    square.save(cropped_path)
    print(f"  → Cropped: {cropped_path.name} ({square.size[0]}×{square.size[1]})")
    return cropped_path


def normalize(cropped_path: Path, crest: dict) -> tuple:
    """Run vga_normalize for 128×128 and 48×48."""
    out_128 = OUTPUT_DIR / f"{crest['id']}_128.png"
    out_48 = OUTPUT_DIR / f"{crest['id']}_48.png"

    for target, out_path in [(128, out_128), (48, out_48)]:
        cmd = [
            sys.executable, str(NORMALIZE_SCRIPT),
            str(cropped_path),
            "-o", str(out_path),
            "--stream", "hybrid",
            "--palette", crest["palette"],
            "--target-width", str(target),
            "--dither", "none",
            "--outline", "dark",
            "--outline-weight", "1",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  ⚠ Normalize {target}px FAILED: {result.stderr[:200]}")
        else:
            # Extract color count from output
            for line in result.stdout.split("\n"):
                if "Output:" in line:
                    print(f"  → {target}px: {line.strip()}")
                    break

    return out_128, out_48


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Batch crest generation")
    parser.add_argument("--only", help="Generate only this crest ID")
    parser.add_argument("--skip-generate", action="store_true",
                        help="Skip Recraft generation, normalize existing raw files")
    args = parser.parse_args()

    token = os.environ.get("RECRAFT_API_TOKEN")
    if not token and not args.skip_generate:
        print("Error: RECRAFT_API_TOKEN not set")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Filter crests if --only
    crests = CRESTS
    if args.only:
        crests = [c for c in CRESTS if c["id"] == args.only]
        if not crests:
            print(f"Unknown crest ID: {args.only}")
            print(f"Available: {', '.join(c['id'] for c in CRESTS)}")
            sys.exit(1)

    if not args.skip_generate:
        client = httpx.Client(
            headers={"Authorization": f"Bearer {token}"},
            timeout=120.0,
        )
    else:
        client = None

    results = []

    for i, crest in enumerate(crests):
        print(f"\n{'='*60}")
        print(f"[{i+1}/{len(crests)}] {crest['name']} ({crest['id']})")
        print(f"{'='*60}")

        # Step 1: Generate (or use existing)
        raw_path = OUTPUT_DIR / f"{crest['id']}_raw.png"
        if args.skip_generate:
            if not raw_path.exists():
                print(f"  ⚠ No raw file found: {raw_path}")
                continue
            print(f"  → Using existing raw: {raw_path.name}")
        else:
            raw_path = generate_raw(client, crest)
            # Brief pause between API calls
            if i < len(crests) - 1:
                time.sleep(1)

        # Step 2: Crop
        cropped_path = crop_and_square(raw_path, crest)

        # Step 3: Normalize
        out_128, out_48 = normalize(cropped_path, crest)

        results.append({
            "id": crest["id"],
            "name": crest["name"],
            "raw": str(raw_path),
            "cropped": str(cropped_path),
            "out_128": str(out_128),
            "out_48": str(out_48),
        })

    if client:
        client.close()

    # Save results manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n{'='*60}")
    print(f"Done! {len(results)} crests processed.")
    print(f"Manifest: {manifest_path}")
    print(f"Review files in: {OUTPUT_DIR}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

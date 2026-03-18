#!/usr/bin/env python3
"""
Batch Land backdrop generation via Recraft API + vga_normalize pipeline.

Generates all 10 Land backdrops:
  1. Recraft API (darklands_atmospheric style_id) → 1820×1024 raw
  2. vga_normalize → 480×270 (atmospheric stream, Land palette)
  3. Pillow nearest-neighbor 4× → 1920×1080

Usage:
  RECRAFT_API_TOKEN="..." python3 scripts/generate_backdrops.py
  RECRAFT_API_TOKEN="..." python3 scripts/generate_backdrops.py --only seelie-groves
  RECRAFT_API_TOKEN="..." python3 scripts/generate_backdrops.py --skip-generate
  RECRAFT_API_TOKEN="..." python3 scripts/generate_backdrops.py --deploy
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

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

STYLE_ID = "c38863e3-7e67-4305-b8ab-ac824f3b545a"  # darklands_atmospheric
GRIM_SUFFIX = "weathered texture, muted earth tones, grim atmosphere, medieval authentic"
ATMO_SUFFIX = "heavy chiaroscuro lighting, atmospheric perspective, deep shadows"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "test-generations" / "backdrops"
NORMALIZE_SCRIPT = PROJECT_ROOT / "scripts" / "vga_normalize.py"
DEPLOY_DIR = PROJECT_ROOT / "static" / "assets" / "lands"

# Resolution chain: 1820×1024 raw → 480×270 VGA → 1920×1080 display
RAW_SIZE = "1820x1024"
VGA_WIDTH = 480       # 480×270 (16:9)
UPSCALE_FACTOR = 4    # 480×4 = 1920, 270×4 = 1080


# ---------------------------------------------------------------------------
# Land Definitions
# ---------------------------------------------------------------------------

LANDS = [
    {
        "id": "seelie-groves",
        "name": "Seelie Groves",
        "palette": "seelie_groves",
        "prompt": (
            "ancient oak forest interior, massive twisted tree trunks, "
            "dappled amber light filtering through dense canopy, "
            "moss-covered roots, silver-tinged bark, art nouveau organic curves, "
            "empty clearing in center foreground for furniture placement"
        ),
    },
    {
        "id": "freemark-reaches",
        "name": "Freemark Reaches",
        "palette": "freemark_reaches",
        "prompt": (
            "medieval frontier town square, timber and stone buildings, "
            "dusty cobblestone road, warm daylight, practical architecture, "
            "tavern sign and hitching post visible, adventurous open atmosphere, "
            "empty center area for furniture placement"
        ),
    },
    {
        "id": "ironroot-holdings",
        "name": "Ironroot Holdings",
        "palette": "ironroot_holdings",
        "prompt": (
            "dwarven underground hall, massive stone columns and copper pipes, "
            "forge glow mixing with cool stone light, geometric carved walls, "
            "heavy blocky construction, stalactites above, "
            "empty center floor area for furniture placement"
        ),
    },
    {
        "id": "shire-hearths",
        "name": "Shire of Many Hearths",
        "palette": "shire_hearths",
        "prompt": (
            "cozy hobbit-like interior, round doorways and warm hearth glow, "
            "golden hour light through small round windows, thatched roof beams, "
            "cluttered shelves along walls, inviting warm orange atmosphere, "
            "empty center area for furniture placement"
        ),
    },
    {
        "id": "vaults-precieux",
        "name": "Vaults of Précieux",
        "palette": "vaults_precieux",
        "prompt": (
            "underground clockwork vault, brass gears and gem-encrusted walls, "
            "warm lamplight reflecting off polished metal surfaces, "
            "precise gnomish engineering, dark iron framework, ruby accents, "
            "empty center area for furniture placement"
        ),
    },
    {
        "id": "fenward-commons",
        "name": "Fenward Commons",
        "palette": "fenward_commons",
        "prompt": (
            "misty swamp settlement, wooden boardwalks over murky water, "
            "dim torchlight through heavy fog, thatched huts on stilts, "
            "lanterns on tall poles, cattails and murky green vegetation, "
            "empty center boardwalk area for furniture placement"
        ),
    },
    {
        "id": "mire-grok",
        "name": "Mire of Grok",
        "palette": "mire_grok",
        "prompt": (
            "toxic jungle lair, glowing green pools of poison, "
            "bone decorations and skulls on wooden spikes, "
            "sickly bioluminescent fungus, brutal orcish construction, "
            "heavy dark canopy above, "
            "empty center clearing for furniture placement"
        ),
    },
    {
        "id": "scoria-warrens",
        "name": "Scoria Warrens",
        "palette": "scoria_warrens",
        "prompt": (
            "desert canyon interior, ancient carved sandstone walls, "
            "bronze and rust-colored rock formations, "
            "reptilian scale patterns in architecture, harsh sun from above, "
            "cool underground shadows, archaeological ruins, "
            "empty center area for furniture placement"
        ),
    },
    {
        "id": "temple-frozen",
        "name": "Temple of Frozen Thought",
        "palette": "temple_frozen",
        "prompt": (
            "austere ice temple interior, crystalline blue walls, "
            "minimalist zen architecture, snow drifting through open arches, "
            "cool diffused blue light, clean geometric ice formations, "
            "simple robes hanging on pegs, "
            "empty center meditation area for furniture placement"
        ),
    },
    {
        "id": "bottomless-satchel",
        "name": "Bottomless Satchel",
        "palette": "bottomless_satchel",
        "prompt": (
            "formless purple void, floating fragments of reality, "
            "deep indigo darkness with violet shimmer, "
            "objects glowing faintly from within, ethereal drifting particles, "
            "no ground no sky just endless depth, "
            "slightly brighter center area for furniture placement"
        ),
    },
]


# ---------------------------------------------------------------------------
# Pipeline Functions
# ---------------------------------------------------------------------------

def generate_raw(client: httpx.Client, land: dict) -> Path:
    """Generate 1820×1024 raw backdrop via Recraft API."""
    raw_path = OUTPUT_DIR / f"{land['id']}_raw.png"

    prompt = f"{land['prompt']}, {ATMO_SUFFIX}, {GRIM_SUFFIX}"

    print(f"  Generating: {land['name']}...")
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


def normalize(raw_path: Path, land: dict) -> Path:
    """Run vga_normalize → 480×270 atmospheric."""
    vga_path = OUTPUT_DIR / f"{land['id']}_vga.png"

    cmd = [
        sys.executable, str(NORMALIZE_SCRIPT),
        str(raw_path),
        "-o", str(vga_path),
        "--stream", "atmospheric",
        "--palette", land["palette"],
        "--target-width", str(VGA_WIDTH),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  !! Normalize FAILED: {result.stderr[:300]}")
        return None

    for line in result.stdout.split("\n"):
        if "Output:" in line or "colors" in line.lower():
            print(f"  -> VGA: {line.strip()}")

    return vga_path


def upscale(vga_path: Path, land: dict) -> Path:
    """Nearest-neighbor 4× upscale → 1920×1080."""
    final_path = OUTPUT_DIR / f"{land['id']}_final.png"

    img = Image.open(vga_path)
    w, h = img.size
    target_w = w * UPSCALE_FACTOR
    target_h = h * UPSCALE_FACTOR

    upscaled = img.resize((target_w, target_h), Image.NEAREST)
    upscaled.save(final_path)

    size_kb = final_path.stat().st_size / 1024
    print(f"  -> Final: {target_w}x{target_h} ({size_kb:.1f} KB)")
    return final_path


def deploy(final_path: Path, land: dict) -> Path:
    """Copy final backdrop to static/assets/lands/{id}/backdrop.png."""
    land_dir = DEPLOY_DIR / land["id"]
    land_dir.mkdir(parents=True, exist_ok=True)
    deploy_path = land_dir / "backdrop.png"

    import shutil
    shutil.copy2(final_path, deploy_path)
    print(f"  -> Deployed: {deploy_path.relative_to(PROJECT_ROOT)}")
    return deploy_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Batch Land backdrop generation")
    parser.add_argument("--only", help="Generate only this Land ID")
    parser.add_argument("--skip-generate", action="store_true",
                        help="Skip Recraft generation, normalize existing raw files")
    parser.add_argument("--deploy", action="store_true",
                        help="Deploy final assets to static/assets/lands/")
    args = parser.parse_args()

    token = os.environ.get("RECRAFT_API_TOKEN")
    if not token and not args.skip_generate:
        print("Error: RECRAFT_API_TOKEN not set")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Filter lands
    lands = LANDS
    if args.only:
        lands = [land for land in LANDS if land["id"] == args.only]
        if not lands:
            print(f"Unknown Land ID: {args.only}")
            print(f"Available: {', '.join(land['id'] for land in LANDS)}")
            sys.exit(1)

    if not args.skip_generate:
        client = httpx.Client(
            headers={"Authorization": f"Bearer {token}"},
            timeout=120.0,
        )
    else:
        client = None

    results = []

    for i, land in enumerate(lands):
        print(f"\n{'='*60}")
        print(f"[{i+1}/{len(lands)}] {land['name']} ({land['id']})")
        print(f"{'='*60}")

        # Step 1: Generate raw (or use existing)
        raw_path = OUTPUT_DIR / f"{land['id']}_raw.png"
        if args.skip_generate:
            if not raw_path.exists():
                print(f"  !! No raw file found: {raw_path}")
                continue
            print(f"  -> Using existing raw: {raw_path.name}")
        else:
            raw_path = generate_raw(client, land)
            if i < len(lands) - 1:
                time.sleep(2)  # Rate limit pause

        # Step 2: Normalize to VGA
        vga_path = normalize(raw_path, land)
        if not vga_path:
            continue

        # Step 3: Upscale to 1920×1080
        final_path = upscale(vga_path, land)

        # Step 4: Deploy (if requested)
        deploy_path = None
        if args.deploy:
            deploy_path = deploy(final_path, land)

        results.append({
            "id": land["id"],
            "name": land["name"],
            "raw": str(raw_path),
            "vga": str(vga_path),
            "final": str(final_path),
            "deployed": str(deploy_path) if deploy_path else None,
        })

    if client:
        client.close()

    # Save manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n{'='*60}")
    print(f"Done! {len(results)} backdrops processed.")
    print(f"Manifest: {manifest_path}")
    print(f"Review files in: {OUTPUT_DIR}")
    if not args.deploy:
        print("Run with --deploy to copy to static/assets/lands/")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

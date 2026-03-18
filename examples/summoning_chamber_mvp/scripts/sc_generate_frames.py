#!/usr/bin/env python3
"""
Batch UI frame generation via Recraft API + vga_normalize pipeline.

Generates 4 master frames, derives 8 variants via Pillow transforms:
  1. Recraft API (darklands_ui style_id) → 1024×1024 raw
  2. vga_normalize → target size (64/96/32)
  3. Pillow derive variants (brightness, tint, crop)
  4. Programmatic assets (backdrop, dividers)

Usage:
  RECRAFT_API_TOKEN="..." python3 scripts/generate_frames.py
  RECRAFT_API_TOKEN="..." python3 scripts/generate_frames.py --only panel-frame
  python3 scripts/generate_frames.py --skip-generate          # normalize + derive only
  python3 scripts/generate_frames.py --skip-generate --deploy  # copy to static/
"""

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

try:
    import httpx
    from PIL import Image, ImageEnhance  # noqa: F401
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("pip3 install Pillow httpx")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

STYLE_ID = "8aea00f3-97c8-4e61-afc4-d1bddb7fa7cd"  # darklands_ui
GRIM_SUFFIX = "weathered texture, muted earth tones, grim atmosphere, medieval authentic"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "test-generations" / "frames"
DEPLOY_DIR = PROJECT_ROOT / "static" / "assets" / "ui" / "panels"
NORMALIZE_SCRIPT = PROJECT_ROOT / "scripts" / "vga_normalize.py"

# Master frame definitions — these get Recraft generations
MASTERS = [
    {
        "id": "panel-frame",
        "name": "Panel Frame",
        "target_width": 64,
        "prompt": (
            "medieval stone panel frame, beveled metal edges with bronze corner rivets, "
            "dark weathered stone border, parchment-toned interior field, "
            "uniform center area, symmetric corners, functional UI panel"
        ),
    },
    {
        "id": "card-frame",
        "name": "Card Frame",
        "target_width": 64,
        "prompt": (
            "thin medieval card border, hammered bronze edge with subtle corner studs, "
            "dark oak wood texture, clean interior field, "
            "lightweight frame suitable for selection card"
        ),
    },
    {
        "id": "modal-frame",
        "name": "Modal Frame",
        "target_width": 96,
        "prompt": (
            "ornate medieval panel frame, heavy stone border with decorative carved corners, "
            "iron rivets along edges, deep beveled profile, imposing fortress panel, "
            "dark stone with bronze accents, parchment interior"
        ),
    },
    {
        "id": "tooltip",
        "name": "Tooltip Frame",
        "target_width": 32,
        "prompt": (
            "small compact medieval tooltip border, thin hammered metal edge, "
            "minimal decoration, dark iron frame, simple beveled profile"
        ),
    },
]


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def generate_raw(client: httpx.Client, master: dict) -> Path:
    """Generate 1024×1024 raw frame via Recraft API."""
    raw_path = OUTPUT_DIR / f"{master['id']}_raw.png"

    prompt = f"{master['prompt']}, {GRIM_SUFFIX}"

    print(f"  Generating: {master['name']}...")
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

    img_response = client.get(image_url, timeout=60.0)
    raw_path.write_bytes(img_response.content)
    print(f"  → Raw: {raw_path.name} ({len(img_response.content)} bytes)")
    return raw_path


def normalize_frame(raw_path: Path, master: dict) -> Path:
    """Run vga_normalize to target size."""
    out_path = OUTPUT_DIR / f"{master['id']}.png"
    target = master["target_width"]

    cmd = [
        sys.executable, str(NORMALIZE_SCRIPT),
        str(raw_path),
        "-o", str(out_path),
        "--stream", "hybrid",
        "--palette", "ui_chrome",
        "--target-width", str(target),
        "--dither", "none",
        "--outline", "contextual",
        "--outline-weight", "1",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ⚠ Normalize {target}px FAILED: {result.stderr[:200]}")
    else:
        for line in result.stdout.split("\n"):
            if "Output:" in line:
                print(f"  → {target}px: {line.strip()}")
                break

    return out_path


# ---------------------------------------------------------------------------
# 9-Slice Verification
# ---------------------------------------------------------------------------

def verify_9slice(frame_path: Path, master: dict) -> bool:
    """Check that center region is uniform enough for 9-slice stretching."""
    img = Image.open(frame_path)
    w, h = img.size

    # Determine slice inset based on target size
    if master["target_width"] == 96:
        inset = 24
    elif master["target_width"] == 32:
        inset = 8
    else:
        inset = 20

    if w < inset * 2 or h < inset * 2:
        print("  ⚠ Frame too small for 9-slice verification")
        return False

    # Extract center region
    center = img.crop((inset, inset, w - inset, h - inset))
    pixels = list(center.getdata())

    if not pixels:
        return False

    # Calculate color variance in center
    avg_r = sum(p[0] for p in pixels) / len(pixels)
    avg_g = sum(p[1] for p in pixels) / len(pixels)
    avg_b = sum(p[2] for p in pixels) / len(pixels)

    var_r = sum((p[0] - avg_r) ** 2 for p in pixels) / len(pixels)
    var_g = sum((p[1] - avg_g) ** 2 for p in pixels) / len(pixels)
    var_b = sum((p[2] - avg_b) ** 2 for p in pixels) / len(pixels)

    total_var = (var_r + var_g + var_b) ** 0.5
    print(f"  → Center uniformity: variance={total_var:.1f} (avg RGB: {avg_r:.0f},{avg_g:.0f},{avg_b:.0f})")

    # Threshold: below 30 = very uniform, 30-60 = acceptable, above 60 = needs flattening
    if total_var > 60:
        print("  ⚠ Center too varied — will flatten to median color")
        return False
    elif total_var > 30:
        print("  ◈ Center has some texture — acceptable but monitor")
    else:
        print("  ◈ Center is clean — good for 9-slice")

    return True


def flatten_center(frame_path: Path, master: dict) -> Path:
    """Flatten center region to its median color for clean 9-slice tiling."""
    img = Image.open(frame_path).convert("RGB")
    w, h = img.size

    if master["target_width"] == 96:
        inset = 24
    elif master["target_width"] == 32:
        inset = 8
    else:
        inset = 20

    # Get median color of center
    center = img.crop((inset, inset, w - inset, h - inset))
    pixels = list(center.getdata())
    avg_r = int(sum(p[0] for p in pixels) / len(pixels))
    avg_g = int(sum(p[1] for p in pixels) / len(pixels))
    avg_b = int(sum(p[2] for p in pixels) / len(pixels))

    # Fill center with median
    for y in range(inset, h - inset):
        for x in range(inset, w - inset):
            img.putpixel((x, y), (avg_r, avg_g, avg_b))

    img.save(frame_path)
    print(f"  → Flattened center to RGB({avg_r},{avg_g},{avg_b})")
    return frame_path


# ---------------------------------------------------------------------------
# Variant Derivation
# ---------------------------------------------------------------------------

def derive_brightness(source_path: Path, out_path: Path, factor: float, contrast: float = 1.0) -> Path:
    """Derive a brightness/contrast variant."""
    img = Image.open(source_path)
    img = ImageEnhance.Brightness(img).enhance(factor)
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    img.save(out_path)
    print(f"  → Derived: {out_path.name} (brightness={factor}, contrast={contrast})")
    return out_path


def derive_hover(source_path: Path, out_path: Path, inset: int = 20) -> Path:
    """Derive hover state — brighten border, keep interior."""
    img = Image.open(source_path).convert("RGB")
    w, h = img.size

    # Brighten border region only
    for y in range(h):
        for x in range(w):
            if x < inset or x >= w - inset or y < inset or y >= h - inset:
                r, g, b = img.getpixel((x, y))
                # Brighten by ~20% with slight warm shift
                r = min(255, int(r * 1.2 + 5))
                g = min(255, int(g * 1.15 + 3))
                b = min(255, int(b * 1.1))
                img.putpixel((x, y), (r, g, b))

    img.save(out_path)
    print(f"  → Derived: {out_path.name} (hover — brightened border)")
    return out_path


def derive_selected(source_path: Path, out_path: Path, inset: int = 20) -> Path:
    """Derive selected state — tint border toward gold/accent."""
    img = Image.open(source_path).convert("RGB")
    w, h = img.size

    # Gold accent tint on border
    gold_r, gold_g, gold_b = 160, 120, 40  # from UI_PALETTE index 13

    for y in range(h):
        for x in range(w):
            if x < inset or x >= w - inset or y < inset or y >= h - inset:
                r, g, b = img.getpixel((x, y))
                # Blend 30% toward gold
                r = int(r * 0.7 + gold_r * 0.3)
                g = int(g * 0.7 + gold_g * 0.3)
                b = int(b * 0.7 + gold_b * 0.3)
                img.putpixel((x, y), (r, g, b))

    img.save(out_path)
    print(f"  → Derived: {out_path.name} (selected — gold border tint)")
    return out_path


def derive_sidebar(source_path: Path, out_path: Path, inset: int = 20) -> Path:
    """Derive sidebar frame — thin/remove left border."""
    img = Image.open(source_path).convert("RGB")
    w, h = img.size

    # Get interior color from center
    center_color = img.getpixel((w // 2, h // 2))

    # Replace left border (0 to inset) with interior color
    # Keep a 2px edge for visual grounding
    for y in range(h):
        for x in range(0, inset - 2):
            img.putpixel((x, y), center_color)

    img.save(out_path)
    print(f"  → Derived: {out_path.name} (sidebar — left border removed)")
    return out_path


def extract_divider_h(source_path: Path, out_path: Path) -> Path:
    """Extract horizontal divider from frame's top edge."""
    img = Image.open(source_path).convert("RGB")
    w, h = img.size

    # Take a 4px strip from the middle of the top border (around y=10 for 64px frame)
    strip_y = min(10, h // 6)
    strip = img.crop((0, strip_y, w, strip_y + 4))
    strip.save(out_path)
    print(f"  → Extracted: {out_path.name} ({strip.size[0]}×{strip.size[1]})")
    return out_path


def extract_divider_v(source_path: Path, out_path: Path) -> Path:
    """Extract vertical divider from frame's left edge."""
    img = Image.open(source_path).convert("RGB")
    w, h = img.size

    # Take a 4px strip from the middle of the left border (around x=10 for 64px frame)
    strip_x = min(10, w // 6)
    strip = img.crop((strip_x, 0, strip_x + 4, h))
    strip.save(out_path)
    print(f"  → Extracted: {out_path.name} ({strip.size[0]}×{strip.size[1]})")
    return out_path


def create_backdrop(out_path: Path) -> Path:
    """Create semi-transparent dark overlay tile programmatically."""
    import random
    random.seed(42)  # Reproducible noise

    img = Image.new("RGBA", (64, 64), (15, 12, 10, 178))
    pixels = img.load()

    # Add subtle 2-color noise for VGA texture
    for y in range(64):
        for x in range(64):
            if random.random() < 0.15:  # 15% noise density
                noise = random.choice([-8, -4, 4, 8])
                r, g, b, a = pixels[x, y]
                r = max(0, min(255, r + noise))
                g = max(0, min(255, g + noise))
                b = max(0, min(255, b + noise))
                pixels[x, y] = (r, g, b, a)

    img.save(out_path)
    print(f"  → Created: {out_path.name} (64×64 RGBA backdrop)")
    return out_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Batch UI frame generation")
    parser.add_argument("--only", help="Generate only this master ID")
    parser.add_argument("--skip-generate", action="store_true",
                        help="Skip Recraft generation, process existing raw files")
    parser.add_argument("--deploy", action="store_true",
                        help="Copy validated assets to static/assets/ui/panels/")
    args = parser.parse_args()

    token = os.environ.get("RECRAFT_API_TOKEN")
    if not token and not args.skip_generate:
        print("Error: RECRAFT_API_TOKEN not set")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Filter masters if --only
    masters = MASTERS
    if args.only:
        masters = [m for m in MASTERS if m["id"] == args.only]
        if not masters:
            print(f"Unknown master ID: {args.only}")
            print(f"Available: {', '.join(m['id'] for m in MASTERS)}")
            sys.exit(1)

    if not args.skip_generate:
        client = httpx.Client(
            headers={"Authorization": f"Bearer {token}"},
            timeout=120.0,
        )
    else:
        client = None

    results = []

    # ---- Phase 1: Generate + Normalize Masters ----
    print(f"\n{'='*60}")
    print("PHASE 1: Master Frame Generation")
    print(f"{'='*60}")

    for i, master in enumerate(masters):
        print(f"\n{'='*60}")
        print(f"[{i+1}/{len(masters)}] {master['name']} ({master['id']})")
        print(f"{'='*60}")

        raw_path = OUTPUT_DIR / f"{master['id']}_raw.png"
        if args.skip_generate:
            if not raw_path.exists():
                print(f"  ⚠ No raw file found: {raw_path}")
                continue
            print(f"  → Using existing raw: {raw_path.name}")
        else:
            raw_path = generate_raw(client, master)
            if i < len(masters) - 1:
                time.sleep(1)

        # Normalize to target size
        frame_path = normalize_frame(raw_path, master)

        # Verify 9-slice center uniformity
        if frame_path.exists():
            is_uniform = verify_9slice(frame_path, master)
            if not is_uniform:
                flatten_center(frame_path, master)

        results.append({
            "id": master["id"],
            "name": master["name"],
            "raw": str(raw_path),
            "normalized": str(frame_path),
            "target_width": master["target_width"],
        })

    if client:
        client.close()

    # ---- Phase 2: Derive Variants ----
    # Only derive if we have the panel-frame and card-frame masters
    panel_path = OUTPUT_DIR / "panel-frame.png"
    card_path = OUTPUT_DIR / "card-frame.png"

    print(f"\n{'='*60}")
    print("PHASE 2: Variant Derivation")
    print(f"{'='*60}")

    if panel_path.exists():
        print("\nDeriving from panel-frame:")
        derive_brightness(panel_path, OUTPUT_DIR / "panel-dark.png", factor=0.7, contrast=1.15)
        derive_brightness(panel_path, OUTPUT_DIR / "panel-light.png", factor=1.2, contrast=0.95)
        derive_sidebar(panel_path, OUTPUT_DIR / "sidebar-frame.png")
        extract_divider_h(panel_path, OUTPUT_DIR / "divider-h.png")
        extract_divider_v(panel_path, OUTPUT_DIR / "divider-v.png")
    else:
        print("  ⚠ panel-frame.png not found — skipping panel variants")

    if card_path.exists():
        print("\nDeriving from card-frame:")
        derive_hover(card_path, OUTPUT_DIR / "card-frame-hover.png")
        derive_selected(card_path, OUTPUT_DIR / "card-frame-selected.png")
    else:
        print("  ⚠ card-frame.png not found — skipping card variants")

    print("\nProgrammatic assets:")
    create_backdrop(OUTPUT_DIR / "modal-backdrop.png")

    # ---- Phase 3: Deploy ----
    if args.deploy:
        print(f"\n{'='*60}")
        print("PHASE 3: Deploy to static/assets/ui/panels/")
        print(f"{'='*60}")

        deploy_files = [
            "panel-frame.png", "panel-dark.png", "panel-light.png",
            "card-frame.png", "card-frame-hover.png", "card-frame-selected.png",
            "modal-frame.png", "modal-backdrop.png",
            "sidebar-frame.png", "tooltip.png",
            "divider-h.png", "divider-v.png",
        ]

        deployed = 0
        for filename in deploy_files:
            src = OUTPUT_DIR / filename
            dst = DEPLOY_DIR / filename
            if src.exists():
                shutil.copy2(src, dst)
                size = dst.stat().st_size
                print(f"  → {filename} ({size} bytes)")
                deployed += 1
            else:
                print(f"  ⚠ Missing: {filename}")

        print(f"\nDeployed {deployed}/{len(deploy_files)} assets")

    # Save manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Done! {len(results)} masters processed.")
    print(f"Manifest: {manifest_path}")
    print(f"Review files in: {OUTPUT_DIR}")
    if not args.deploy:
        print(f"Run with --deploy to copy to {DEPLOY_DIR}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

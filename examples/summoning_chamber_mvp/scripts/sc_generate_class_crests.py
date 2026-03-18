#!/usr/bin/env python3
"""
Generate Class Heraldic Crests (11 classes × 2 sizes = 22 images)

Uses proven crest workflow from Land crest generation (Sessions 4-5):
- Style preset: rd_plus__classic (strong outlines, simple shading)
- Resolution: 128×128 for full size, 48×48 for small
- Generation: 2 variations per class for selection
- Palette: ui_chrome (neutral palette for crests)
- Output: Transparent background via remove_bg
"""

import base64
import io
import sys
from pathlib import Path

from PIL import Image

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from scripts.rd_api import RDClient

# Class crest specifications
CLASS_CRESTS = [
    {
        "id": "scryer",
        "name": "Scryer",
        "symbol": "crystal ball with mystical eye",
        "description": "Crystal ball on ornate stand with seeing eye symbol, mystical insight",
    },
    {
        "id": "magister",
        "name": "Magister",
        "symbol": "open book with quill",
        "description": "Open spellbook with crossed quill, knowledge and scholarship",
    },
    {
        "id": "hammerer",
        "name": "Hammerer",
        "symbol": "hammer and anvil",
        "description": "Blacksmith hammer crossed with anvil, craftsmanship and forging",
    },
    {
        "id": "craftsman",
        "name": "Craftsman",
        "symbol": "paintbrush and chisel",
        "description": "Artist's brush crossed with sculptor's chisel, artisan creativity",
    },
    {
        "id": "diplomat",
        "name": "Diplomat",
        "symbol": "handshake over scroll",
        "description": "Clasped hands above sealed scroll, negotiation and agreements",
    },
    {
        "id": "herald",
        "name": "Herald",
        "symbol": "ceremonial horn",
        "description": "Ornate herald's horn with banner unfurled, proclamation and announcement",
    },
    {
        "id": "warden",
        "name": "Warden",
        "symbol": "shield with lantern",
        "description": "Protective shield with vigilant lantern, guardianship and watchfulness",
    },
    {
        "id": "counselor",
        "name": "Counselor",
        "symbol": "heart with seated chair",
        "description": "Compassionate heart above counseling chair, empathy and guidance",
    },
    {
        "id": "merchant",
        "name": "Merchant",
        "symbol": "balance scales with coins",
        "description": "Merchant's scales balanced with gold coins, trade and commerce",
    },
    {
        "id": "seneschal",
        "name": "Seneschal",
        "symbol": "strategic map with crown",
        "description": "Tactical map beneath commander's crown, leadership and strategy",
    },
    {
        "id": "bard",
        "name": "Bard",
        "symbol": "lute with musical note",
        "description": "Ornate lute with flowing musical note, performance and storytelling",
    },
]


def generate_class_crests(api_token: str):
    """Generate all class crests (2 variations each, 2 sizes each)."""

    client = RDClient(api_token)

    # Output directories
    raw_dir = project_root / "raw" / "crests" / "classes"
    deploy_dir = project_root / "static" / "assets" / "icons" / "classes"
    desktop_dir = Path.home() / "Desktop"

    raw_dir.mkdir(parents=True, exist_ok=True)
    deploy_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print("CLASS CREST GENERATION")
    print(f"{'='*60}\n")
    print(f"Total classes: {len(CLASS_CRESTS)}")
    print("Variations per class: 2")
    print("Sizes per variation: 2 (128×128 + 48×48)")
    print(f"Total images to generate: {len(CLASS_CRESTS) * 2} (will be scaled to 2 sizes each)")
    print(f"Output: {raw_dir}")
    print(f"Desktop copies: {desktop_dir}\n")

    total_generated = 0
    total_failed = 0

    for class_spec in CLASS_CRESTS:
        class_id = class_spec["id"]
        class_name = class_spec["name"]
        symbol = class_spec["symbol"]
        description = class_spec["description"]

        print(f"\n{'─'*60}")
        print(f"Class: {class_name} ({class_id})")
        print(f"Symbol: {symbol}")
        print(f"{'─'*60}")

        # Generate 2 variations at 128×128
        for var_num in range(1, 3):
            print(f"\n  Variation {var_num}/2...")

            # Prompt following Land crest pattern
            prompt = (
                f"heraldic shield crest emblem, {description}, "
                f"centered {symbol}, shield shape, "
                f"clear silhouette, distinct color regions, "
                f"medieval heraldry, dark fantasy, "
                f"ornate but readable, VGA pixel art"
            )

            try:
                # Generate at 128×128 (full size)
                result = client.generate(
                    prompt=prompt,
                    style="rd_plus__classic",  # Strong outlines, heraldic style
                    width=128,
                    height=128,
                    num_images=1,
                    land="ui_chrome",  # Neutral palette for crests
                    remove_bg=True,
                    dark_mood=True,
                )

                if result and result.base64_images:
                    img_data = base64.b64decode(result.base64_images[0])
                    img = Image.open(io.BytesIO(img_data))

                    # Save full size (128×128)
                    full_path = raw_dir / f"{class_id}-var{var_num}-128.png"
                    img.save(full_path, "PNG")
                    print(f"    ✓ Generated 128×128: {full_path.name}")

                    # Generate small size (48×48) via nearest-neighbor downsample
                    img_small = img.resize((48, 48), Image.NEAREST)
                    small_path = raw_dir / f"{class_id}-var{var_num}-48.png"
                    img_small.save(small_path, "PNG")
                    print(f"    ✓ Generated 48×48: {small_path.name}")

                    # Desktop copies for review
                    desktop_full = desktop_dir / f"{class_id}-var{var_num}-128.png"
                    desktop_small = desktop_dir / f"{class_id}-var{var_num}-48.png"
                    img.save(desktop_full, "PNG")
                    img_small.save(desktop_small, "PNG")

                    total_generated += 2  # Count both sizes

                    # Show cost
                    cost = result.credit_cost
                    remaining = result.remaining_credits
                    print(f"    Cost: {cost} credits | Remaining: {remaining} credits")

                else:
                    print("    ✗ FAILED: No image data returned")
                    total_failed += 1

            except Exception as e:
                print(f"    ✗ FAILED: {e}")
                total_failed += 1

    # Summary
    print(f"\n{'='*60}")
    print("GENERATION COMPLETE")
    print(f"{'='*60}")
    print(f"Total generated: {total_generated} images ({total_generated // 2} full + {total_generated // 2} small)")
    print(f"Total failed: {total_failed} generations")
    print(f"Success rate: {(total_generated / (total_generated + total_failed) * 100):.1f}%")
    print(f"\nRaw files: {raw_dir}")
    print(f"Desktop review: {desktop_dir}")
    print("\nNext steps:")
    print("1. Review all variations on Desktop")
    print("2. Select best variation for each class")
    print(f"3. Deploy selected crests to {deploy_dir}")
    print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_class_crests.py <RD_API_TOKEN>")
        sys.exit(1)

    api_token = sys.argv[1]
    generate_class_crests(api_token)

#!/usr/bin/env python3
"""
Generate canonical Class/Land master scenes using validated letterboxing technique.

Generates 10 master scenes (1 per Land) with 2-3 variations each:
1. Seelie Groves → Elf Scryer
2. Freemark Reaches → Human Magister
3. Ironroot Holdings → Dwarf Hammerer
4. Shire of Many Hearths → Smallfolk Craftsman
5. Vaults of Précieux → Gnome Diplomat
6. Fenward Commons → Goblin Herald
7. Mire of Grok → Orc Warden
8. Scoria Warrens → Scalekind Counselor
9. Temple of Frozen Thought → Monk Merchant
10. Bottomless Satchel → Spirit Seneschal

Uses letterboxing technique:
- Generate 256×256 with 3 reference images
- Letterbox onto 480×270 canvas (dark background)
- Upscale 4× to 1920×1080 via nearest-neighbor

Saves all variations to Desktop for review.
"""

import base64
import os
import sys
from pathlib import Path

from PIL import Image
from rd_api import RDClient

# Canonical scene configurations
CANONICAL_SCENES = [
    {
        "land": "seelie_groves",
        "land_name": "Seelie Groves",
        "class": "scryer",
        "class_name": "Scryer",
        "denizen": "Elf",
        "denizen_type": "elf",
        "backdrop": "static/assets/lands/seelie-groves-backdrop.png",
        "character": "static/assets/characters/elf/elf-scryer.png",
        "overlay": "static/assets/classes/scryer/overlay.png",
        "environment": "ancient grove library",
        "furniture": "scrying mirror, crystal orb, mystical tomes, silver candelabra",
        "keywords": "organic curves, silver accents, art nouveau, warm amber light filtered through leaves"
    },
    {
        "land": "freemark_reaches",
        "land_name": "Freemark Reaches",
        "class": "magister",
        "class_name": "Magister",
        "denizen": "Human",
        "denizen_type": "human",
        "backdrop": "static/assets/lands/freemark-reaches-backdrop.png",
        "character": "static/assets/characters/human/human-magister.png",
        "overlay": "static/assets/classes/magister/overlay.png",
        "environment": "practical timber study",
        "furniture": "tall bookshelves, writing desk with open tome, brass candelabra",
        "keywords": "practical timber, steel highlights, warm daylight atmosphere"
    },
    {
        "land": "ironroot_holdings",
        "land_name": "Ironroot Holdings",
        "class": "hammerer",
        "class_name": "Hammerer",
        "denizen": "Dwarf",
        "denizen_type": "dwarf",
        "backdrop": "static/assets/lands/ironroot-holdings-backdrop.png",
        "character": "static/assets/characters/dwarf/dwarf-hammerer.png",
        "overlay": "static/assets/classes/hammerer/overlay.png",
        "environment": "stone workshop forge",
        "furniture": "anvil, tool rack, weapon displays, copper brazier",
        "keywords": "massive stone, copper fixtures, geometric patterns, warm forge glow with cool stone"
    },
    {
        "land": "shire_hearths",
        "land_name": "Shire of Many Hearths",
        "class": "craftsman",
        "class_name": "Craftsman",
        "denizen": "Smallfolk",
        "denizen_type": "smallfolk",
        "backdrop": "static/assets/lands/shire-hearths-backdrop.png",
        "character": "static/assets/characters/smallfolk/smallfolk-craftsman.png",
        "overlay": "static/assets/classes/craftsman/overlay.png",
        "environment": "cozy workshop",
        "furniture": "workbench with tools, storage chest, warm lantern, project materials",
        "keywords": "round shapes, warm orange tones, cozy cluttered, golden hour hearth glow"
    },
    {
        "land": "vaults_precieux",
        "land_name": "Vaults of Précieux",
        "class": "diplomat",
        "class_name": "Diplomat",
        "denizen": "Gnome",
        "denizen_type": "gnome",
        "backdrop": "static/assets/lands/vaults-precieux-backdrop.png",
        "character": "static/assets/characters/gnome/gnome-diplomat.png",
        "overlay": "static/assets/classes/diplomat/overlay.png",
        "environment": "clockwork meeting chamber",
        "furniture": "ornate desk with documents, brass gears, gem-accented furniture",
        "keywords": "clockwork brass, gem highlights, precise geometric, warm lamplight with gem glow"
    },
    {
        "land": "fenward_commons",
        "land_name": "Fenward Commons",
        "class": "herald",
        "class_name": "Herald",
        "denizen": "Goblin",
        "denizen_type": "goblin",
        "backdrop": "static/assets/lands/fenward-commons-backdrop.png",
        "character": "static/assets/characters/goblin/goblin-herald.png",
        "overlay": "static/assets/classes/herald/overlay.png",
        "environment": "swamp hall podium",
        "furniture": "speaking podium, message scrolls, improvised furnishings, foggy atmosphere",
        "keywords": "murky green, fog effects, improvised swamp materials, dim foggy torchlight"
    },
    {
        "land": "mire_grok",
        "land_name": "Mire of Grok",
        "class": "warden",
        "class_name": "Warden",
        "denizen": "Orc",
        "denizen_type": "orc",
        "backdrop": "static/assets/lands/mire-grok-backdrop.png",
        "character": "static/assets/characters/orc/orc-warden.png",
        "overlay": "static/assets/classes/warden/overlay.png",
        "environment": "brutal guard station",
        "furniture": "weapon racks, bone trophies, crude throne, toxic glowing brazier",
        "keywords": "toxic green glow, bone decorations, brutal improvised, sickly bioluminescence"
    },
    {
        "land": "scoria_warrens",
        "land_name": "Scoria Warrens",
        "class": "counselor",
        "class_name": "Counselor",
        "denizen": "Scalekind",
        "denizen_type": "scalekind",
        "backdrop": "static/assets/lands/scoria-warrens-backdrop.png",
        "character": "static/assets/characters/scalekind/scalekind-counselor.png",
        "overlay": "static/assets/classes/counselor/overlay.png",
        "environment": "desert meditation chamber",
        "furniture": "meditation cushions, ancient scrolls, bronze incense burner, carved stone altar",
        "keywords": "desert tan, bronze jewelry, ancient carved stone, harsh sun filtering to cool underground"
    },
    {
        "land": "temple_frozen",
        "land_name": "Temple of Frozen Thought",
        "class": "merchant",
        "class_name": "Merchant",
        "denizen": "Monk",
        "denizen_type": "monk",
        "backdrop": "static/assets/lands/temple-frozen-backdrop.png",
        "character": "static/assets/characters/monk/monk-merchant.png",
        "overlay": "static/assets/classes/merchant/overlay.png",
        "environment": "minimalist trading post",
        "furniture": "simple counter, organized goods display, clean ledger desk, snow-frosted window",
        "keywords": "ice blue, minimalist clean lines, snow accents, cool blue diffused light"
    },
    {
        "land": "bottomless_satchel",
        "land_name": "Bottomless Satchel",
        "class": "seneschal",
        "class_name": "Seneschal",
        "denizen": "Spirit",
        "denizen_type": "spirit",
        "backdrop": "static/assets/lands/bottomless-satchel-backdrop.png",
        "character": "static/assets/characters/spirit/spirit-seneschal.png",
        "overlay": "static/assets/classes/seneschal/overlay.png",
        "environment": "ethereal void archive",
        "furniture": "floating shelves, ethereal desk, glowing documents, void-suspended objects",
        "keywords": "deep purple void, floating fragments, ethereal translucent, objects glow from within"
    }
]


def encode_image_to_base64(image_path):
    """Encode image file to base64 string."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode('utf-8')


def letterbox_and_upscale(img_256, output_size=(1920, 1080), bg_color=(20, 18, 15)):
    """
    Letterbox 256×256 image onto 16:9 canvas and upscale.

    Process:
    1. Create 480×270 canvas with dark background
    2. Scale 256×256 to 270×270 (nearest-neighbor)
    3. Center horizontally (105px offset)
    4. Upscale 4× to final resolution
    """
    # Create intermediate canvas (480×270)
    canvas = Image.new('RGB', (480, 270), bg_color)

    # Scale square image to 270×270 (maintains aspect ratio)
    scaled = img_256.resize((270, 270), Image.NEAREST)

    # Center horizontally: (480 - 270) / 2 = 105px offset
    canvas.paste(scaled, (105, 0))

    # Upscale 4× to final resolution
    final = canvas.resize(output_size, Image.NEAREST)

    return final


def generate_scene(scene_config, variation_num, client, output_dir):
    """Generate a single master scene with letterboxing."""

    # Build prompt
    prompt = (
        f"{scene_config['denizen']} {scene_config['class_name']} character in "
        f"{scene_config['environment']}, "
        f"{scene_config['furniture']}, "
        f"character standing center at floor level, "
        f"furniture arranged around character at appropriate depths, "
        f"medieval fantasy interior scene, "
        f"{scene_config['keywords']}, "
        f"dark weathered materials, dim atmospheric lighting, "
        f"full scene composition 1920x1080, "
        f"NO TEXT, NO UI ELEMENTS, NO BORDERS"
    )

    print(f"\n{'='*80}")
    print(f"Generating: {scene_config['land_name']} / {scene_config['class_name']} (var {variation_num})")
    print(f"{'='*80}")
    print(f"Prompt: {prompt[:100]}...")

    # Encode reference images
    print("Encoding reference images...")
    backdrop_b64 = encode_image_to_base64(scene_config['backdrop'])
    character_b64 = encode_image_to_base64(scene_config['character'])
    overlay_b64 = encode_image_to_base64(scene_config['overlay'])

    # Generate at 256×256 with references
    print("Calling RD API (256×256 with 3 references)...")
    result = client.generate(
        prompt=prompt,
        style='rd_pro__fantasy',
        width=256,
        height=256,
        land=scene_config['land'],
        remove_bg=False,
        dark_mood=True,  # Auto-appends dark keywords
        reference_images=[backdrop_b64, character_b64, overlay_b64]
    )

    print(f"Cost: {result.credit_cost} credits | Remaining: {result.remaining_credits}")

    # Letterbox and upscale
    print("Letterboxing and upscaling to 1920×1080...")
    img_256 = result.images[0]
    final = letterbox_and_upscale(img_256)

    # Save to output directory
    filename = f"{scene_config['land']}-{scene_config['class']}-var{variation_num}.png"
    output_path = output_dir / filename
    final.save(output_path, "PNG")
    print(f"Saved: {output_path}")

    # Also save to Desktop for review
    desktop = Path.home() / "Desktop"
    desktop_path = desktop / filename
    final.save(desktop_path, "PNG")
    print(f"Desktop copy: {desktop_path}")

    return {
        "scene": scene_config,
        "variation": variation_num,
        "output_path": str(output_path),
        "desktop_path": str(desktop_path),
        "cost": result.credit_cost,
        "remaining_credits": result.remaining_credits
    }


def main():
    # Get API token from command line or environment
    token = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("RD_API_TOKEN")

    if not token:
        print("ERROR: No API token provided.")
        print("Usage: python generate_master_scenes.py <RD_API_TOKEN>")
        print("   or: RD_API_TOKEN=xxx python generate_master_scenes.py")
        sys.exit(1)

    # Initialize RD client
    print("Initializing Retro Diffusion API client...")
    client = RDClient(token=token)

    # Check credits
    credits_info = client.check_credits()
    print(f"Starting credits: {credits_info}")

    # Create output directory
    output_dir = Path("raw/master_scenes/canonical")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate configuration
    variations_per_scene = 2  # Start with 2, can increase to 3 if budget allows

    # Track results
    all_results = []
    total_cost = 0

    # Generate scenes
    for scene_config in CANONICAL_SCENES:
        print(f"\n\n{'#'*80}")
        print(f"# Scene: {scene_config['land_name']} → {scene_config['denizen']} {scene_config['class_name']}")
        print(f"{'#'*80}")

        for var_num in range(1, variations_per_scene + 1):
            try:
                result = generate_scene(scene_config, var_num, client, output_dir)
                all_results.append(result)
                total_cost += result['cost']
            except Exception as e:
                print(f"ERROR generating {scene_config['land']}/{scene_config['class']} var{var_num}: {e}")
                continue

    # Summary
    print(f"\n\n{'='*80}")
    print("GENERATION COMPLETE")
    print(f"{'='*80}")
    print(f"Total scenes generated: {len(all_results)}")
    print(f"Total cost: {total_cost} credits (~${total_cost * 0.076:.2f})")
    print(f"Remaining credits: {all_results[-1]['remaining_credits'] if all_results else 'N/A'}")
    print("\nAll images saved to:")
    print(f"  - Raw: {output_dir}")
    print("  - Desktop: ~/Desktop/")
    print("\nReview images on Desktop and select best variation for each scene.")


if __name__ == "__main__":
    main()

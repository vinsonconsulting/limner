#!/usr/bin/env python3
"""
generate_scene.py — Retro Diffusion scene/environment generator for Summoning Chamber.

Usage:
    python3 scripts/generate_scene.py --prompt "your scene description" [options]

Examples:
    # Basic splash screen (1440x900)
    python3 scripts/generate_scene.py \
        --prompt "Interior of enormous cavernous castle great hall" \
        --size 1440x900 --count 4

    # Standard 1920x1080 environment
    python3 scripts/generate_scene.py \
        --prompt "dark forest clearing with standing stones" \
        --size 1920x1080 --count 2

    # Custom palette from a Land
    python3 scripts/generate_scene.py \
        --prompt "subterranean vault with glowing crystals" \
        --size 1440x900 --palette vaults --count 3

    # With a name prefix for output files
    python3 scripts/generate_scene.py \
        --prompt "tavern interior" \
        --name "tavern_interior" --count 4
"""

import argparse
import base64
import io
import os
import sys
from pathlib import Path

try:
    import requests
    from PIL import Image
except ImportError:
    print("Missing dependencies. Install with: pip3 install requests Pillow")
    sys.exit(1)


# ── Palettes ──────────────────────────────────────────────────────────
# Dark Palette Standard base + per-Land accent overrides.
# Each palette is a list of 16 RGB tuples packed into an 8x2 PNG.

PALETTES = {
    "chamber": [
        # Row 1: dark stone grays + arcane purples
        (26, 26, 29), (42, 42, 46), (74, 74, 82), (61, 43, 79),
        (30, 42, 58), (107, 91, 167), (20, 18, 15), (35, 30, 40),
        # Row 2: torch amber + gold + warm browns
        (139, 105, 20), (155, 132, 50), (90, 60, 15), (50, 35, 25),
        (45, 40, 55), (70, 55, 40), (100, 80, 50), (30, 25, 35),
    ],
    "seelie": [
        (20, 18, 15), (30, 35, 25), (45, 55, 35), (60, 75, 45),
        (35, 50, 30), (80, 100, 55), (25, 20, 18), (40, 35, 28),
        (100, 85, 40), (120, 100, 50), (70, 55, 30), (50, 40, 25),
        (55, 65, 40), (75, 60, 35), (90, 75, 45), (28, 25, 20),
    ],
    "freemark": [
        (20, 18, 15), (35, 30, 25), (55, 45, 35), (75, 60, 42),
        (40, 35, 28), (95, 75, 50), (25, 20, 18), (45, 38, 30),
        (130, 100, 30), (150, 120, 45), (80, 60, 25), (55, 42, 22),
        (60, 50, 38), (85, 70, 45), (110, 90, 55), (30, 25, 20),
    ],
    "ironroot": [
        (20, 18, 15), (32, 32, 35), (50, 50, 55), (70, 68, 75),
        (35, 30, 40), (90, 85, 100), (22, 20, 18), (38, 35, 32),
        (120, 90, 25), (140, 110, 40), (85, 65, 20), (55, 42, 18),
        (48, 45, 50), (65, 55, 42), (95, 80, 50), (28, 26, 24),
    ],
    "vaults": [
        (18, 18, 22), (30, 30, 38), (48, 48, 60), (38, 55, 75),
        (28, 40, 55), (70, 90, 120), (15, 15, 20), (35, 35, 42),
        (100, 130, 150), (80, 100, 125), (55, 70, 90), (40, 50, 65),
        (45, 45, 55), (60, 70, 85), (75, 85, 100), (22, 22, 28),
    ],
    "scoria": [
        (22, 18, 15), (38, 28, 22), (58, 38, 25), (80, 45, 20),
        (45, 30, 18), (100, 55, 25), (18, 15, 12), (42, 32, 25),
        (140, 80, 20), (160, 100, 30), (90, 50, 15), (60, 35, 15),
        (50, 38, 28), (70, 50, 30), (110, 70, 30), (25, 20, 15),
    ],
}

# ── Size presets ──────────────────────────────────────────────────────
# final_size → (native_w, native_h, scale_factor)
SIZE_PRESETS = {
    "1440x900":  (360, 225, 4),
    "1920x1080": (480, 270, 4),
    "1280x800":  (320, 200, 4),   # classic VGA
    "960x600":   (320, 200, 3),
}

# ── Style anchors ─────────────────────────────────────────────────────
STYLE_SUFFIX = (
    "VGA pixel art, 320x200 aesthetic, dithered shading, visible pixels, "
    "Darklands 1992 inspired, DOS game background scene"
)

DARK_STANDARD = (
    "weathered worn blackened medieval stonework, crumbling ancient, "
    "very dark interior, grim medieval atmosphere, dark fantasy"
)


def make_palette_png(colors: list[tuple]) -> str:
    """Pack 16 RGB tuples into an 8x2 PNG, return base64."""
    img = Image.new("RGB", (8, 2))
    for i, c in enumerate(colors):
        img.putpixel((i % 8, i // 8), c)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def load_api_key() -> str:
    """Find RD API key from env or .env files."""
    key = os.environ.get("RD_API_TOKEN", "")
    if key:
        return key
    search_paths = [
        Path.cwd() / ".env",
        Path.home() / "Documents/GitHub/summoning-chamber/.env",
    ]
    for p in search_paths:
        try:
            for line in p.read_text().splitlines():
                if "RD_API_TOKEN" in line and "=" in line:
                    return line.split("=", 1)[1].strip().strip("\"'")
        except (FileNotFoundError, PermissionError):
            continue
    return ""


def generate(
    prompt: str,
    native_w: int,
    native_h: int,
    scale: int,
    palette_b64: str,
    api_key: str,
    style: str = "rd_plus__environment",
    model: str = "RD_CLASSIC",
) -> Image.Image | None:
    """Generate one image via Retro Diffusion API. Returns upscaled PIL Image or None."""
    payload = {
        "prompt": prompt,
        "width": native_w,
        "height": native_h,
        "model": model,
        "style": style,
        "input_palette": palette_b64,
        "bypass_prompt_expansion": True,
        "remove_bg": False,
        "num_images": 1,
    }
    r = requests.post(
        "https://api.retrodiffusion.ai/v1/inferences",
        headers={"X-RD-Token": api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )
    if r.status_code != 200:
        print(f"  API error {r.status_code}: {r.text[:200]}")
        return None

    data = r.json()
    images = data.get("base64_images", [])
    cost = data.get("balance_cost", "?")
    balance = data.get("remaining_balance", "?")
    print(f"  cost: ${cost} | balance: ${balance}")

    if not images:
        print("  No images returned")
        return None

    native = Image.open(io.BytesIO(base64.b64decode(images[0])))
    final_w, final_h = native_w * scale, native_h * scale
    return native, native.resize((final_w, final_h), Image.NEAREST)


def main():
    parser = argparse.ArgumentParser(
        description="Generate VGA pixel art scenes via Retro Diffusion",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--prompt", required=True, help="Scene description (style anchors added automatically)")
    parser.add_argument("--name", default="scene", help="Output filename prefix (default: scene)")
    parser.add_argument("--size", default="1440x900", choices=SIZE_PRESETS.keys(), help="Output dimensions (default: 1440x900)")
    parser.add_argument("--palette", default="chamber", choices=PALETTES.keys(), help="Color palette (default: chamber)")
    parser.add_argument("--count", type=int, default=4, help="Number of variations (default: 4)")
    parser.add_argument("--style", default="rd_plus__environment", help="RD style preset (default: rd_plus__environment)")
    parser.add_argument("--model", default="RD_CLASSIC", choices=["RD_CLASSIC", "RD_FLUX"], help="RD model (default: RD_CLASSIC)")
    parser.add_argument("--outdir", default=None, help="Output directory (default: output/)")
    parser.add_argument("--raw-prompt", action="store_true", help="Use prompt as-is, don't append style anchors")
    parser.add_argument("--no-dark", action="store_true", help="Skip Dark Palette Standard keywords")

    args = parser.parse_args()

    api_key = load_api_key()
    if not api_key:
        print("No RD_API_TOKEN found. Set env var or add to .env file.")
        sys.exit(1)

    # Build full prompt
    parts = [args.prompt]
    if not args.no_dark:
        parts.append(DARK_STANDARD)
    if not args.raw_prompt:
        parts.append(STYLE_SUFFIX)
        parts.append("no characters, empty scene")
    full_prompt = ", ".join(parts)

    # Resolve dimensions
    native_w, native_h, scale = SIZE_PRESETS[args.size]
    final_w, final_h = native_w * scale, native_h * scale

    # Palette
    palette_b64 = make_palette_png(PALETTES[args.palette])

    # Output dir
    outdir = Path(args.outdir) if args.outdir else Path(__file__).parent.parent / "output"
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"Generating {args.count} variations of '{args.name}'")
    print(f"  {native_w}x{native_h} native → {final_w}x{final_h} ({scale}x upscale)")
    print(f"  palette: {args.palette} | style: {args.style} | model: {args.model}")
    print(f"  output: {outdir}/")
    print()

    for i in range(args.count):
        n = i + 1
        print(f"[{n}/{args.count}] Generating...")
        result = generate(
            prompt=full_prompt,
            native_w=native_w,
            native_h=native_h,
            scale=scale,
            palette_b64=palette_b64,
            api_key=api_key,
            style=args.style,
            model=args.model,
        )
        if result:
            native_img, upscaled_img = result
            native_path = outdir / f"{args.name}_v{n}_native.png"
            final_path = outdir / f"{args.name}_v{n}_{final_w}x{final_h}.png"
            native_img.save(native_path)
            upscaled_img.save(final_path)
            print(f"  saved: {final_path}")
        print()

    print("Done.")


if __name__ == "__main__":
    main()

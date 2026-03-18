#!/usr/bin/env python3
"""
palette_check.py — Palette compliance checker for pixel art assets.

Part of the Limner pixel art generation framework.

Validates whether an image's colors fall within or near a specified palette.
Uses Euclidean distance in RGB space to find nearest palette colors and
reports compliance with configurable tolerance thresholds.

Usage:
  # Check against a palette from standard config
  python tools/pixel_art/palette_check.py asset.png --palette seelie_groves

  # Check with custom palette config
  python tools/pixel_art/palette_check.py asset.png --palette seelie_groves \\
      --palette-config path/to/palettes.json

  # List available palettes
  python tools/pixel_art/palette_check.py --list-palettes

  # Adjust tolerance threshold
  python tools/pixel_art/palette_check.py asset.png --palette seelie_groves \\
      --tolerance 50

Quality Gates:
  - EXACT MATCH: Color distance < 5 (perfect palette match)
  - NEAR MATCH: Distance < tolerance (default 40, acceptable with warning)
  - OFF-PALETTE: Distance ≥ tolerance (violation, needs correction)

Example Output:
  Palette Compliance Check
  ========================
  Image: character_sprite.png
  Palette: seelie_groves (9 colors)
  Tolerance: 40

  Results:
    ✓ 42 colors are exact matches (distance < 5)
    ⚠ 3 colors are near matches (distance < 40)
    ✗ 2 colors are off-palette (distance ≥ 40)

  Off-palette colors (need attention):
    RGB(245, 200, 150) → nearest: color_3 (distance: 52)
    RGB(180, 95, 45) → nearest: color_7 (distance: 48)

  Status: FAILED (2 off-palette colors)
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Optional, Tuple

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print("ERROR: Requires Pillow and numpy")
    print("  pip install Pillow numpy")
    sys.exit(1)


def load_palettes(palette_path: Optional[Path] = None) -> Dict:
    """Load palette registry from JSON config.

    Args:
        palette_path: Path to palettes.json. If None, uses default location
                     relative to this script (../../config/palettes.json from tools/pixel_art/)

    Returns:
        Dictionary mapping palette names to color dictionaries:
        {
            "palette_name": {
                "color_0": (R, G, B),
                "color_1": (R, G, B),
                ...
            }
        }

    Raises:
        FileNotFoundError: If palette config file not found
        json.JSONDecodeError: If palette config is invalid JSON
    """
    if palette_path is None:
        # Default: tools/config/palettes.json (relative to this script)
        script_dir = Path(__file__).parent
        palette_path = script_dir.parent / "config" / "palettes.json"

    if not palette_path.exists():
        raise FileNotFoundError(
            f"Palette config not found: {palette_path}\n"
            f"Expected location: tools/config/palettes.json"
        )

    with open(palette_path) as f:
        raw_palettes = json.load(f)

    # Convert JSON structure to format expected by validation functions
    # JSON: {"palette_name": {"colors_rgb": [[R,G,B], ...], ...}}
    # Output: {"palette_name": {"color_0": (R,G,B), "color_1": (R,G,B), ...}}
    palettes = {}
    for palette_name, palette_data in raw_palettes.items():
        if "colors_rgb" not in palette_data:
            print(f"Warning: Palette '{palette_name}' missing 'colors_rgb' field, skipping")
            continue

        # Generate synthetic color names from array indices
        # Original used semantic names like "forest_green", but JSON only has indexed arrays
        colors_dict = {
            f"color_{i}": tuple(color)
            for i, color in enumerate(palette_data["colors_rgb"])
        }
        palettes[palette_name] = colors_dict

    return palettes


def resolve_palette(palette_input: str, palettes: Dict) -> Optional[str]:
    """Resolve palette name or alias to canonical key.

    Args:
        palette_input: User-provided palette identifier (e.g., "seelie_groves", "seelie-groves", "Seelie Groves")
        palettes: Loaded palette dictionary

    Returns:
        Canonical palette key if found, None otherwise
    """
    # Normalize input: lowercase, replace spaces/hyphens with underscores
    key = palette_input.lower().replace(' ', '_').replace('-', '_')

    # Check exact match first
    if key in palettes:
        return key

    # Check if input is a partial match (e.g., "seelie" → "seelie_groves")
    matches = [p for p in palettes.keys() if key in p]
    if len(matches) == 1:
        return matches[0]
    elif len(matches) > 1:
        print(f"Warning: Ambiguous palette '{palette_input}' matches multiple: {matches}")
        print(f"Using first match: {matches[0]}")
        return matches[0]

    return None


def color_distance(c1: Tuple[int, int, int], c2: Tuple[int, int, int]) -> float:
    """Euclidean distance between two RGB tuples.

    Args:
        c1: First RGB color (R, G, B)
        c2: Second RGB color (R, G, B)

    Returns:
        Euclidean distance in RGB space (0 = identical, 441.7 = max distance)
    """
    return np.sqrt(sum((int(a) - int(b)) ** 2 for a, b in zip(c1, c2)))


def find_nearest_palette_color(
    color: Tuple[int, int, int],
    palette_colors: Dict[str, Tuple[int, int, int]]
) -> Tuple[str, float]:
    """Find the nearest palette color and return (name, distance).

    Args:
        color: RGB color to check (R, G, B)
        palette_colors: Dictionary of palette colors {"color_name": (R, G, B)}

    Returns:
        Tuple of (nearest_color_name, distance)
    """
    best_name = None
    best_dist = float('inf')

    for name, pcolor in palette_colors.items():
        dist = color_distance(color, pcolor)
        if dist < best_dist:
            best_dist = dist
            best_name = name

    return best_name, best_dist


def check_palette(
    image_path: Path,
    palette_colors: Dict[str, Tuple[int, int, int]],
    palette_name: str,
    tolerance: int = 40
) -> Tuple[bool, str]:
    """Check image against palette with tolerance threshold.

    Args:
        image_path: Path to PNG/GIF image
        palette_colors: Dictionary of palette colors {"color_name": (R, G, B)}
        palette_name: Name of palette (for reporting)
        tolerance: Maximum acceptable distance for "near match" (default 40)

    Returns:
        Tuple of (passed: bool, report: str)
        - passed: True if all colors are exact or near matches (distance < tolerance)
        - report: Human-readable compliance summary
    """
    if not image_path.exists():
        return False, f"File not found: {image_path}"

    try:
        img = Image.open(image_path).convert('RGB')
    except Exception as e:
        return False, f"Cannot open image: {e}"

    # Get unique colors from image
    pixels = np.array(img)
    unique_colors = np.unique(pixels.reshape(-1, 3), axis=0)

    # Categorize colors by distance to nearest palette color
    exact_matches = []      # distance < 5
    near_matches = []       # distance < tolerance
    off_palette = []        # distance >= tolerance

    for color in unique_colors:
        color_tuple = tuple(color)
        nearest_name, dist = find_nearest_palette_color(color_tuple, palette_colors)

        if dist < 5:
            exact_matches.append((color_tuple, nearest_name, dist))
        elif dist < tolerance:
            near_matches.append((color_tuple, nearest_name, dist))
        else:
            off_palette.append((color_tuple, nearest_name, dist))

    # Generate report
    lines = [
        "\nPalette Compliance Check",
        "=" * 60,
        f"Image: {image_path.name}",
        f"Palette: {palette_name} ({len(palette_colors)} colors)",
        f"Tolerance: {tolerance}",
        "",
        "Results:"
    ]

    if exact_matches:
        lines.append(f"  ✓ {len(exact_matches)} colors are exact matches (distance < 5)")

    if near_matches:
        lines.append(f"  ⚠ {len(near_matches)} colors are near matches (distance < {tolerance})")

    if off_palette:
        lines.append(f"  ✗ {len(off_palette)} colors are off-palette (distance ≥ {tolerance})")

    # Show off-palette colors in detail (these need attention)
    if off_palette:
        lines.append("\nOff-palette colors (need attention):")
        for color, nearest, dist in sorted(off_palette, key=lambda x: x[2], reverse=True):
            lines.append(f"  RGB{color} → nearest: {nearest} (distance: {dist:.1f})")

    # Show near matches if any (warnings but not failures)
    if near_matches and len(near_matches) <= 5:
        lines.append("\nNear matches (acceptable but not exact):")
        for color, nearest, dist in near_matches:
            lines.append(f"  RGB{color} → nearest: {nearest} (distance: {dist:.1f})")
    elif near_matches and len(near_matches) > 5:
        lines.append(f"\nNear matches: {len(near_matches)} total (showing top 5 by distance):")
        for color, nearest, dist in sorted(near_matches, key=lambda x: x[2], reverse=True)[:5]:
            lines.append(f"  RGB{color} → nearest: {nearest} (distance: {dist:.1f})")

    # Final status
    passed = len(off_palette) == 0
    status = "PASSED" if passed else f"FAILED ({len(off_palette)} off-palette colors)"
    lines.append(f"\nStatus: {status}")
    lines.append("=" * 60 + "\n")

    return passed, '\n'.join(lines)


def list_palettes(palettes: Dict) -> str:
    """Generate list of available palettes with color counts.

    Args:
        palettes: Loaded palette dictionary

    Returns:
        Human-readable palette listing
    """
    lines = [
        "\nAvailable Palettes",
        "=" * 60
    ]

    for palette_name, colors in sorted(palettes.items()):
        lines.append(f"{palette_name:30s} ({len(colors):2d} colors)")

    lines.append("=" * 60)
    lines.append(f"\nTotal: {len(palettes)} palettes")
    lines.append("Config: tools/config/palettes.json\n")

    return '\n'.join(lines)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Check pixel art asset against a palette (Limner framework)',
        epilog='Part of Limner - A pixel art generation framework for VGA-era aesthetics'
    )

    parser.add_argument('image', nargs='?', help='Path to image file (PNG/GIF)')
    parser.add_argument('--palette', '-p', help='Palette name to check against')
    parser.add_argument('--tolerance', '-t', type=int, default=40,
                       help='Maximum distance for "near match" (default: 40)')
    parser.add_argument('--palette-config', type=Path,
                       help='Path to palette config JSON (default: tools/config/palettes.json)')
    parser.add_argument('--list-palettes', action='store_true',
                       help='List available palettes and exit')

    args = parser.parse_args()

    # Load palettes
    try:
        palettes = load_palettes(args.palette_config)
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid palette JSON: {e}")
        sys.exit(1)

    # Handle --list-palettes
    if args.list_palettes:
        print(list_palettes(palettes))
        sys.exit(0)

    # Require image and palette for validation
    if not args.image:
        print("ERROR: Image path required (or use --list-palettes)")
        parser.print_help()
        sys.exit(1)

    if not args.palette:
        print("ERROR: --palette required")
        print("\nAvailable palettes:")
        print(list_palettes(palettes))
        sys.exit(1)

    # Resolve palette name
    palette_key = resolve_palette(args.palette, palettes)
    if not palette_key:
        print(f"ERROR: Palette '{args.palette}' not found")
        print("\nAvailable palettes:")
        print(list_palettes(palettes))
        sys.exit(1)

    palette_colors = palettes[palette_key]

    # Run validation
    passed, report = check_palette(
        Path(args.image),
        palette_colors,
        palette_key,
        args.tolerance
    )

    print(report)
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()

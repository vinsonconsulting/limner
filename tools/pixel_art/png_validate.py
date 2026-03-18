#!/usr/bin/env python3
"""
png_validate.py — PNG color mode validator for VGA compliance.

Part of the Limner pixel art generation framework.

Validates whether PNG files use indexed color mode (palette-based, VGA-compliant)
or full RGB/RGBA color mode (non-indexed). Indexed color mode is preferred for
VGA-era pixel art to ensure palette constraints are properly enforced.

Usage:
  # Validate all PNGs in a directory
  python tools/pixel_art/png_validate.py /path/to/assets/

  # Verbose output (shows details for all files)
  python tools/pixel_art/png_validate.py /path/to/assets/ --verbose

  # Validate single file
  python tools/pixel_art/png_validate.py /path/to/asset.png

Quality Gates:
  - Valid VGA modes: P (indexed/palette), PA (indexed + alpha)
  - Invalid modes: RGB, RGBA, L (grayscale), LA (grayscale + alpha)

Output:
  Summary showing count and percentage of indexed vs RGB/RGBA files.
  With --verbose flag, shows color mode for every PNG file.

Example Output:
  PNG Color Mode Validation
  ========================
  Scanned: 545 PNG files

  Results:
    ✓ 10 files use indexed color (1.8%)
    ⚠ 535 files use RGB/RGBA (98.2%)

  Optimization Opportunity: Convert RGB/RGBA → indexed for 20-30% file size reduction

  Status: Non-blocking (color values can be VGA-compliant in RGB mode)
"""

import sys
from pathlib import Path
from typing import Dict, Tuple

try:
    from PIL import Image
except ImportError:
    print("ERROR: Requires Pillow")
    print("  pip install Pillow")
    sys.exit(1)


def check_color_mode(png_path: Path) -> Tuple[bool, str]:
    """Check if PNG uses indexed color mode.

    Args:
        png_path: Path to PNG file

    Returns:
        Tuple of (is_indexed: bool, mode: str)
        - is_indexed: True if mode is P (palette) or PA (palette + alpha)
        - mode: PIL image mode string (P, PA, RGB, RGBA, L, LA, etc.)

    Valid VGA modes:
        - P: Indexed/palette color (8-bit palette indices)
        - PA: Indexed/palette color with alpha channel

    Invalid modes (require conversion):
        - RGB: Full 24-bit color (no palette constraint)
        - RGBA: Full 24-bit color + alpha
        - L: Grayscale (8-bit luminance)
        - LA: Grayscale + alpha
    """
    try:
        img = Image.open(png_path)
        mode = img.mode
        is_indexed = mode in ['P', 'PA']
        img.close()
        return is_indexed, mode
    except Exception as e:
        return False, f"ERROR: {e}"


def scan_directory(directory: Path, verbose: bool = False) -> Dict:
    """Scan directory recursively for PNG files and check color modes.

    Args:
        directory: Path to directory to scan
        verbose: If True, print details for each file

    Returns:
        Dictionary with scan results:
        {
            "total": int,           # Total PNG files scanned
            "indexed": int,         # Count using P or PA mode
            "rgb": int,             # Count using RGB or RGBA mode
            "other": int,           # Count using other modes (L, LA, etc.)
            "errors": int,          # Count of files that couldn't be read
            "indexed_files": list,  # Paths of indexed files
            "rgb_files": list       # Paths of RGB/RGBA files
        }
    """
    results = {
        "total": 0,
        "indexed": 0,
        "rgb": 0,
        "other": 0,
        "errors": 0,
        "indexed_files": [],
        "rgb_files": []
    }

    # Find all PNG files recursively
    png_files = sorted(directory.rglob("*.png"))

    if not png_files:
        print(f"No PNG files found in {directory}")
        return results

    for png_path in png_files:
        results["total"] += 1
        is_indexed, mode = check_color_mode(png_path)

        if mode.startswith("ERROR"):
            results["errors"] += 1
            if verbose:
                print(f"⚠️  {png_path.relative_to(directory)}: {mode}")
        elif is_indexed:
            results["indexed"] += 1
            results["indexed_files"].append(png_path)
            if verbose:
                print(f"✓  {png_path.relative_to(directory)}: {mode} (indexed)")
        elif mode in ['RGB', 'RGBA']:
            results["rgb"] += 1
            results["rgb_files"].append(png_path)
            if verbose:
                print(f"⚠️  {png_path.relative_to(directory)}: {mode} (RGB/RGBA)")
        else:
            results["other"] += 1
            if verbose:
                print(f"⚠️  {png_path.relative_to(directory)}: {mode} (other)")

    return results


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Validate PNG color modes for VGA compliance (Limner framework)',
        epilog='Part of Limner - A pixel art generation framework for VGA-era aesthetics'
    )

    parser.add_argument('path', help='Path to PNG file or directory')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Show details for all files (default: summary only)')

    args = parser.parse_args()

    path = Path(args.path)

    if not path.exists():
        print(f"ERROR: Path not found: {path}")
        sys.exit(1)

    # Single file validation
    if path.is_file():
        if path.suffix.lower() != '.png':
            print(f"ERROR: Not a PNG file: {path}")
            sys.exit(1)

        is_indexed, mode = check_color_mode(path)

        if mode.startswith("ERROR"):
            print(f"⚠️  {path.name}: {mode}")
            sys.exit(1)
        elif is_indexed:
            print(f"✓  {path.name}: {mode} (indexed color) — VGA-compliant")
            sys.exit(0)
        else:
            print(f"⚠️  {path.name}: {mode} (non-indexed) — Consider converting to indexed")
            sys.exit(0)

    # Directory scan
    if not path.is_dir():
        print(f"ERROR: Not a file or directory: {path}")
        sys.exit(1)

    print("\nPNG Color Mode Validation")
    print("=" * 60)
    print(f"Scanning: {path}\n")

    results = scan_directory(path, verbose=args.verbose)

    if results["total"] == 0:
        print("No PNG files found.")
        sys.exit(0)

    # Summary
    print("\n" + "=" * 60)
    print(f"Scanned: {results['total']} PNG files\n")
    print("Results:")

    if results["indexed"] > 0:
        pct_indexed = (results["indexed"] / results["total"]) * 100
        print(f"  ✓ {results['indexed']} files use indexed color ({pct_indexed:.1f}%)")

    if results["rgb"] > 0:
        pct_rgb = (results["rgb"] / results["total"]) * 100
        print(f"  ⚠ {results['rgb']} files use RGB/RGBA ({pct_rgb:.1f}%)")

    if results["other"] > 0:
        pct_other = (results["other"] / results["total"]) * 100
        print(f"  ⚠ {results['other']} files use other modes ({pct_other:.1f}%)")

    if results["errors"] > 0:
        print(f"  ✗ {results['errors']} files could not be read")

    # Optimization note
    if results["rgb"] > 0:
        print("\nOptimization Opportunity:")
        print("  Convert RGB/RGBA → indexed for 20-30% file size reduction")
        print("  Color values can be VGA-compliant even in RGB mode")
        print("  Indexed color enforces palette constraints at file level")

    print("\nStatus: Non-blocking (color mode is optimization, not compliance blocker)")
    print("=" * 60 + "\n")

    sys.exit(0)


if __name__ == '__main__':
    main()

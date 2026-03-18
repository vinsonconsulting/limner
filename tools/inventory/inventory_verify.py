#!/usr/bin/env python3
"""
inventory_verify.py — Quick asset directory scanner.

Part of the Limner pixel art generation framework.

Scans an assets directory and reports file counts by category
with detailed breakdowns. Unlike asset_inventory.py (which checks
against a manifest), this is a simple "what exists?" scanner.

Usage:
  python tools/inventory/inventory_verify.py /path/to/assets
  python tools/inventory/inventory_verify.py static/assets --extensions .png .gif .jpg
"""

import argparse
import sys
from collections import defaultdict
from pathlib import Path


def scan_deployed_assets(assets_dir: Path, extensions: tuple) -> dict:
    """Scan directory and categorize files by top-level subdirectory.

    Args:
        assets_dir: Root directory to scan
        extensions: Tuple of file extensions to include (e.g., ('.png', '.gif'))

    Returns:
        Dictionary mapping category names to lists of relative paths
    """
    categories = defaultdict(list)

    for ext in extensions:
        for file_path in assets_dir.rglob(f'*{ext}'):
            rel_path = file_path.relative_to(assets_dir)
            category = rel_path.parts[0] if len(rel_path.parts) > 1 else 'root'
            categories[category].append(rel_path)

    return categories


def print_subcategory_breakdown(category_name: str, files: list):
    """Print detailed breakdown of files within a category.

    Args:
        category_name: Name of the category
        files: List of relative paths within this category
    """
    subcats = defaultdict(list)
    for path in files:
        if len(path.parts) > 1:
            subcat = path.parts[1]
            subcats[subcat].append(path)
        else:
            subcats['_root'].append(path)

    print(f"\n{category_name.title()} ({len(subcats)} subcategories, {len(files)} files):")
    for subcat in sorted(subcats.keys()):
        count = len(subcats[subcat])
        print(f"  {subcat}: {count} files")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Quick asset directory scanner (Limner framework)',
        epilog='Part of Limner - A pixel art generation framework for VGA-era aesthetics'
    )
    parser.add_argument('directory', help='Directory to scan for assets')
    parser.add_argument('--extensions', '-e', nargs='+', default=['.png', '.gif'],
                       help='File extensions to include (default: .png .gif)')

    args = parser.parse_args()
    assets_dir = Path(args.directory)

    if not assets_dir.exists():
        print(f"Error: Directory not found: {assets_dir}")
        sys.exit(1)

    extensions = tuple(args.extensions)

    print(f"Scanning {assets_dir} for deployed assets...")
    print("=" * 70)

    categories = scan_deployed_assets(assets_dir, extensions)

    # Print summary
    print("\nAsset Inventory by Category")
    print("=" * 70)

    total_files = 0
    for category in sorted(categories.keys()):
        count = len(categories[category])
        total_files += count
        print(f"{category:20s} {count:4d} files")

    print("=" * 70)
    print(f"{'TOTAL':20s} {total_files:4d} files")

    # Detailed breakdown for categories with subcategories
    print("\n\nDetailed Breakdown")
    print("=" * 70)

    for category in sorted(categories.keys()):
        files = categories[category]
        if any(len(p.parts) > 1 for p in files):
            print_subcategory_breakdown(category, files)

    print("\n" + "=" * 70)
    print("Report complete.")


if __name__ == '__main__':
    main()

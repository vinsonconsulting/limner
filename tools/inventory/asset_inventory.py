#!/usr/bin/env python3
"""
asset_inventory.py — Asset inventory report against a manifest.

Part of the Limner pixel art generation framework.

Scans an assets directory and compares against an expected asset manifest
(JSON file). Reports what exists, what's missing, and progress by category.

Usage:
  # Check assets against a manifest
  python tools/inventory/asset_inventory.py --root /path/to/project \
      --manifest examples/summoning_chamber_mvp/asset_manifest.json

  # Filter by category
  python tools/inventory/asset_inventory.py --root . --manifest manifest.json \
      --category icons

Manifest Format (JSON):
  {
    "assets_dir": "static/assets",
    "categories": {
      "ui/buttons": ["btn-normal.png", "btn-hover.png", ...]
    },
    "generated_categories": {
      "lands": {
        "items": ["seelie-groves", ...],
        "per_item": ["backdrop.png", "crest.png"],
        "path_template": "lands/{item}/{asset}"  // optional, default
      }
    }
  }
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path


def load_manifest(manifest_path: Path) -> dict:
    """Load asset manifest from JSON file.

    Args:
        manifest_path: Path to manifest JSON

    Returns:
        Manifest dictionary with categories and generated_categories

    Raises:
        FileNotFoundError: If manifest not found
        json.JSONDecodeError: If invalid JSON
    """
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    with open(manifest_path) as f:
        return json.load(f)


def scan_directory(root: Path, assets_subdir: str = "assets"):
    """Scan assets directory and return set of relative paths.

    Args:
        root: Project root directory
        assets_subdir: Subdirectory containing assets (from manifest's assets_dir)

    Returns:
        Tuple of (found_files: set, assets_dir: Path)
    """
    assets_dir = root / assets_subdir
    if not assets_dir.exists():
        return set(), assets_dir

    found = set()
    for f in assets_dir.rglob("*"):
        if f.is_file() and f.suffix.lower() in ('.png', '.gif'):
            found.add(str(f.relative_to(assets_dir)))
    return found, assets_dir


def generate_expected_list(manifest: dict) -> list:
    """Expand manifest into flat list of relative paths.

    Args:
        manifest: Loaded manifest dictionary

    Returns:
        List of expected relative paths (e.g., "ui/buttons/btn-normal.png")
    """
    expected = []

    # Static categories: { "category_path": ["file.png", ...] }
    for category, items in manifest.get("categories", {}).items():
        if isinstance(items, list):
            for asset in items:
                expected.append(f"{category}/{asset}")

    # Generated categories: expand item × per_item combinations
    for category, spec in manifest.get("generated_categories", {}).items():
        items = spec.get("items", [])
        per_item = spec.get("per_item", [])
        template = spec.get("path_template", f"{category}/{{item}}/{{asset}}")

        for item in items:
            for asset in per_item:
                path = template.format(item=item, asset=asset)
                expected.append(path)

    return expected


def report(root_path: str, manifest_path: str, category_filter: str = None):
    """Generate asset inventory report.

    Args:
        root_path: Project root directory
        manifest_path: Path to manifest JSON
        category_filter: Optional category prefix to filter results
    """
    manifest = load_manifest(Path(manifest_path))
    root = Path(root_path)

    assets_subdir = manifest.get("assets_dir", "assets")
    found_files, assets_dir = scan_directory(root, assets_subdir)
    expected = generate_expected_list(manifest)

    if category_filter:
        expected = [e for e in expected if e.startswith(category_filter)]

    # Categorize
    present = []
    missing = []
    extra = set(found_files)

    for asset in expected:
        normalized = asset.replace('\\', '/')
        if normalized in found_files or any(normalized in f for f in found_files):
            present.append(asset)
            extra.discard(normalized)
        else:
            missing.append(asset)

    # Group by category
    missing_by_cat = defaultdict(list)
    for m in missing:
        cat = '/'.join(m.split('/')[:2]) if '/' in m else m.split('/')[0]
        missing_by_cat[cat].append(m.split('/')[-1])

    present_by_cat = defaultdict(list)
    for p in present:
        cat = '/'.join(p.split('/')[:2]) if '/' in p else p.split('/')[0]
        present_by_cat[cat].append(p.split('/')[-1])

    # Print report
    print(f"\n{'='*60}")
    print("Asset Inventory Report")
    print(f"Root: {root}")
    print(f"Assets dir: {assets_dir}")
    print(f"Manifest: {manifest_path}")
    print(f"{'='*60}")

    total_expected = len(expected)
    total_present = len(present)
    total_missing = len(missing)
    completion = total_present / max(total_expected, 1)

    print(f"\nOverall: {total_present}/{total_expected} ({completion:.0%})")
    print(f"  Present: {total_present}")
    print(f"  Missing: {total_missing}")
    print(f"  Extra (untracked): {len(extra)}")

    # Category breakdown
    all_cats = sorted(set(list(missing_by_cat.keys()) + list(present_by_cat.keys())))

    print(f"\n{'Category':<30} {'Present':>8} {'Missing':>8} {'Progress':>10}")
    print(f"{'-'*30} {'-'*8} {'-'*8} {'-'*10}")

    for cat in all_cats:
        p = len(present_by_cat.get(cat, []))
        m = len(missing_by_cat.get(cat, []))
        total = p + m
        pct = p / max(total, 1)
        bar = '\u2588' * int(pct * 10) + '\u2591' * (10 - int(pct * 10))
        print(f"  {cat:<28} {p:>8} {m:>8} {bar} {pct:.0%}")

    # Missing details
    if missing and not category_filter:
        print("\nMissing Assets (top 30):")
        for m in missing[:30]:
            print(f"  \u00b7 {m}")
        if len(missing) > 30:
            print(f"  ... and {len(missing) - 30} more")
    elif missing:
        print(f"\nMissing in '{category_filter}':")
        for m in missing:
            print(f"  \u00b7 {m}")

    print(f"\n{'='*60}\n")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Asset inventory report against a manifest (Limner framework)',
        epilog='Part of Limner - A pixel art generation framework for VGA-era aesthetics'
    )
    parser.add_argument('--root', default='.', help='Project root directory')
    parser.add_argument('--manifest', '-m', required=True,
                       help='Path to asset manifest JSON')
    parser.add_argument('--category', '-c',
                       help='Filter by category (e.g., "icons", "ui/buttons")')

    args = parser.parse_args()
    report(args.root, args.manifest, args.category)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
vga_validate.py — VGA compliance checker for pixel art assets.

Part of the Limner pixel art generation framework.

Validates pixel art assets against VGA-era standards:
  1. Color count (≤256 unique colors)
  2. Hard pixel edges (no anti-aliasing on transparency)
  3. Dithered gradients (no smooth color transitions)
  4. Dimension warnings for large assets
  5. File format compliance (PNG/GIF)

Usage:
  # Single file validation
  python tools/pixel_art/vga_validate.py path/to/asset.png

  # Batch validation
  python tools/pixel_art/vga_validate.py --batch path/to/directory/

Returns:
  Exit code 0 if all checks pass (warnings allowed)
  Exit code 1 if any critical errors found

Quality Gates:
  - ERRORS: Palette violations (>256 colors), excessive anti-aliasing
  - WARNINGS: Moderate anti-aliasing, smooth gradients, large dimensions
  - INFO: Color count, transparency stats, file metadata

Example Output:
  ============================================================
  VGA Validation: character_sprite.png
  ============================================================

  Info:
    ℹ Unique colors: 42
    ℹ Semi-transparent pixels: 12 (2.3% of transparent area)
    ℹ Smooth transitions: 15%
    ℹ Dimensions: 256×256
    ℹ Format: PNG
    ℹ Mode: RGBA
    ℹ File size: 15,234 bytes

  Result: ✓ PASSED
  ============================================================
"""

import argparse
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print("ERROR: Requires Pillow and numpy")
    print("  pip install Pillow numpy")
    sys.exit(1)


class VGAValidator:
    """VGA-era pixel art compliance validator.

    Checks assets against 1990-1993 DOS game standards (Darklands, Hillsfar era).

    Attributes:
        MAX_COLORS: 256 (VGA palette limit)
        AA_ALPHA_THRESHOLD: Alpha range indicating anti-aliasing
        GRADIENT_THRESHOLD: RGB difference indicating smooth gradient
    """

    MAX_COLORS = 256
    # Semi-transparent pixels indicate anti-aliasing on edges
    AA_ALPHA_THRESHOLD = 10  # pixels with alpha between 1-this are suspect
    # Gradient smoothness: if adjacent pixels differ by <threshold, might be smooth
    GRADIENT_THRESHOLD = 3

    def __init__(self, filepath):
        """Initialize validator for a specific file.

        Args:
            filepath: Path to PNG or GIF file
        """
        self.filepath = Path(filepath)
        self.errors = []
        self.warnings = []
        self.info = []
        self.image = None

    def validate(self):
        """Run all validation checks.

        Returns:
            Tuple of (passed: bool, report: str)
            - passed: True if no errors (warnings allowed)
            - report: Human-readable validation summary
        """
        if not self.filepath.exists():
            return False, f"File not found: {self.filepath}"

        if self.filepath.suffix.lower() not in ('.png', '.gif'):
            self.errors.append(f"Invalid format: {self.filepath.suffix} (expected .png or .gif)")
            return False, self._report()

        try:
            self.image = Image.open(self.filepath)
        except Exception as e:
            return False, f"Cannot open image: {e}"

        self._check_color_count()
        self._check_transparency_edges()
        self._check_smooth_gradients()
        self._check_dimensions()
        self._report_info()

        passed = len(self.errors) == 0
        return passed, self._report()

    def _check_color_count(self):
        """Verify ≤256 unique colors (VGA palette constraint)."""
        img = self.image.convert('RGBA')
        pixels = np.array(img)
        # Count unique RGBA combinations
        flat = pixels.reshape(-1, 4)
        # Exclude fully transparent pixels
        visible = flat[flat[:, 3] > 0]
        if len(visible) == 0:
            self.warnings.append("Image is fully transparent")
            return
        # Count unique RGB values (ignoring alpha for color count)
        unique_colors = len(np.unique(visible[:, :3], axis=0))
        self.info.append(f"Unique colors: {unique_colors}")
        if unique_colors > self.MAX_COLORS:
            self.errors.append(
                f"PALETTE VIOLATION: {unique_colors} colors (max {self.MAX_COLORS}). "
                f"Reduce palette or apply indexed color conversion."
            )

    def _check_transparency_edges(self):
        """Detect anti-aliased transparency (semi-transparent edge pixels).

        VGA-era assets should have hard edges: pixels are either fully opaque
        or fully transparent. Semi-transparent pixels indicate modern anti-aliasing.
        """
        if self.image.mode != 'RGBA':
            return  # No alpha channel, skip

        pixels = np.array(self.image)
        alpha = pixels[:, :, 3]

        # Count pixels with partial transparency (anti-aliasing indicator)
        partial = np.sum((alpha > 0) & (alpha < 255))
        total_with_alpha = np.sum(alpha < 255)

        if total_with_alpha == 0:
            return  # No transparency at all

        partial_ratio = partial / max(total_with_alpha, 1)
        self.info.append(f"Semi-transparent pixels: {partial} ({partial_ratio:.1%} of transparent area)")

        if partial > 50:  # More than 50 semi-transparent pixels is suspicious
            self.warnings.append(
                f"POSSIBLE ANTI-ALIASING: {partial} semi-transparent edge pixels detected. "
                f"VGA assets should have hard transparency edges (fully opaque or fully transparent)."
            )
        if partial > 200:
            self.errors.append(
                f"ANTI-ALIASING DETECTED: {partial} semi-transparent pixels. "
                f"Clean edges required — no alpha fringe."
            )

    def _check_smooth_gradients(self):
        """Detect suspiciously smooth color transitions (should be dithered).

        VGA-era assets used dithering to simulate gradients. Smooth gradients
        indicate modern rendering that doesn't match the target aesthetic.
        """
        img = self.image.convert('RGB')
        pixels = np.array(img, dtype=np.int16)

        if pixels.shape[0] < 4 or pixels.shape[1] < 4:
            return  # Too small to meaningfully check

        # Check horizontal transitions
        h_diff = np.abs(np.diff(pixels, axis=1))
        # Smooth gradient = many consecutive small differences
        smooth_h = np.sum(np.all(h_diff < self.GRADIENT_THRESHOLD, axis=2))

        # Check vertical transitions
        v_diff = np.abs(np.diff(pixels, axis=0))
        smooth_v = np.sum(np.all(v_diff < self.GRADIENT_THRESHOLD, axis=2))

        total_transitions = (pixels.shape[0] * (pixels.shape[1] - 1) +
                             (pixels.shape[0] - 1) * pixels.shape[1])
        smooth_total = smooth_h + smooth_v
        smooth_ratio = smooth_total / max(total_transitions, 1)

        self.info.append(f"Smooth transitions: {smooth_ratio:.1%}")

        # High smooth ratio might indicate flat color (OK) or smooth gradients (bad)
        # Only warn if there's also moderate color variety (suggesting gradient, not flat)
        if smooth_ratio > 0.6:
            img_indexed = self.image.convert('RGB')
            colors = len(np.unique(np.array(img_indexed).reshape(-1, 3), axis=0))
            if colors > 32:  # Lots of colors + lots of smooth transitions = likely smooth gradient
                self.warnings.append(
                    f"POSSIBLE SMOOTH GRADIENT: {smooth_ratio:.0%} smooth transitions with "
                    f"{colors} colors. Expected dithered transitions for VGA style."
                )

    def _check_dimensions(self):
        """Report dimensions and flag unusually large assets."""
        w, h = self.image.size
        self.info.append(f"Dimensions: {w}×{h}")

        if w > 512 or h > 512:
            self.warnings.append(
                f"Large asset ({w}×{h}). Consider whether this needs compositing "
                f"from smaller pieces for generation efficiency."
            )

    def _report_info(self):
        """Add general file metadata."""
        self.info.append(f"Format: {self.image.format}")
        self.info.append(f"Mode: {self.image.mode}")
        file_size = self.filepath.stat().st_size
        self.info.append(f"File size: {file_size:,} bytes")

    def _report(self):
        """Generate human-readable validation report."""
        lines = [f"\n{'='*60}", f"VGA Validation: {self.filepath.name}", f"{'='*60}"]

        if self.info:
            lines.append("\nInfo:")
            for i in self.info:
                lines.append(f"  ℹ {i}")

        if self.warnings:
            lines.append("\nWarnings:")
            for w in self.warnings:
                lines.append(f"  ⚠ {w}")

        if self.errors:
            lines.append("\nErrors:")
            for e in self.errors:
                lines.append(f"  ✗ {e}")

        status = "✓ PASSED" if not self.errors else "✗ FAILED"
        lines.append(f"\nResult: {status}")
        lines.append(f"{'='*60}\n")

        return '\n'.join(lines)


def validate_batch(directory):
    """Validate all PNG/GIF files in a directory recursively.

    Args:
        directory: Path to directory containing assets

    Prints:
        Individual validation reports + batch summary
    """
    directory = Path(directory)
    if not directory.is_dir():
        print(f"Not a directory: {directory}")
        sys.exit(1)

    files = sorted(list(directory.rglob('*.png')) + list(directory.rglob('*.gif')))
    if not files:
        print(f"No PNG/GIF files found in {directory}")
        return

    passed = 0
    failed = 0
    warned = 0

    for f in files:
        v = VGAValidator(f)
        ok, report = v.validate()
        if ok:
            if v.warnings:
                warned += 1
            else:
                passed += 1
        else:
            failed += 1
        print(report)

    print(f"\nBatch Summary: {passed} passed, {warned} passed with warnings, {failed} failed ({len(files)} total)")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Validate VGA pixel art assets (Limner framework)',
        epilog='Part of Limner - A pixel art generation framework for VGA-era aesthetics'
    )
    parser.add_argument('path', help='Path to asset file or directory (with --batch)')
    parser.add_argument('--batch', action='store_true',
                        help='Validate all PNG/GIF files in directory recursively')
    args = parser.parse_args()

    if args.batch:
        validate_batch(args.path)
    else:
        v = VGAValidator(args.path)
        ok, report = v.validate()
        print(report)
        sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
vga_normalize.py — VGA-era post-processing pipeline for pixel art.

Part of the Limner pixel art generation framework.

Transforms modern AI-generated assets into authentic VGA-compliant pixel art:
  - Background removal (optional)
  - Downscaling to pixel resolution
  - Floyd-Steinberg dithering with palette enforcement
  - Outline enhancement (4 modes)
  - Alpha channel cleanup
  - Nearest-neighbor upscaling for display

Usage:
  # Single file with atmospheric stream
  python tools/pixel_art/vga_normalize.py input.png -o output.png \\
    --stream atmospheric --palette seelie_groves

  # Batch processing
  python tools/pixel_art/vga_normalize.py --batch raw/ -o display/ \\
    --stream clean --palette ui_chrome

  # Custom palette config
  python tools/pixel_art/vga_normalize.py input.png -o output.png \\
    --palette-config /path/to/palettes.json --palette my_palette

  # List available palettes
  python tools/pixel_art/vga_normalize.py --list-palettes

Streams:
  atmospheric: Background dithering, no outlines (environments, backdrops)
  clean: No dithering, dark outlines, transparent background (sprites, props)
  hybrid: Dithering + contextual outlines (furniture, UI)

Palette Config Format (JSON):
  {
    "palette_name": {
      "colors_rgb": [[R, G, B], [R, G, B], ...],
      "description": "Optional description"
    }
  }

Dependencies: Pillow, numpy, scipy (optional for advanced outline dilation)
"""

import argparse
import json
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print("ERROR: Requires Pillow and numpy")
    print("  pip install Pillow numpy")
    sys.exit(1)

try:
    from scipy.ndimage import binary_dilation
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


class OutlineMode(Enum):
    """Outline enhancement modes."""
    NONE = "none"
    DARK = "dark"
    SINGLE = "single"
    CONTEXTUAL = "contextual"


@dataclass
class StreamConfig:
    """Pipeline configuration per rendering stream."""
    remove_bg: bool = False
    dithering: bool = False
    outline_mode: OutlineMode = OutlineMode.NONE
    outline_weight: int = 1


# Stream presets
STREAMS = {
    "atmospheric": StreamConfig(
        remove_bg=False,
        dithering=True,
        outline_mode=OutlineMode.NONE,
        outline_weight=1
    ),
    "clean": StreamConfig(
        remove_bg=True,
        dithering=False,
        outline_mode=OutlineMode.DARK,
        outline_weight=1
    ),
    "hybrid": StreamConfig(
        remove_bg=False,
        dithering=True,
        outline_mode=OutlineMode.CONTEXTUAL,
        outline_weight=1
    ),
}


def load_palettes(palette_path=None):
    """Load palette definitions from JSON file.

    Args:
        palette_path: Path to palettes.json. If None, uses default location
                     at tools/config/palettes.json

    Returns:
        Dictionary mapping palette names to color lists.
        Colors are converted from JSON arrays [R,G,B] to tuples (R,G,B)
        for PIL compatibility.

    Raises:
        FileNotFoundError: If palette file doesn't exist
        json.JSONDecodeError: If JSON is malformed
    """
    if palette_path is None:
        script_dir = Path(__file__).parent
        palette_path = script_dir.parent / "config" / "palettes.json"

    palette_path = Path(palette_path)
    if not palette_path.exists():
        raise FileNotFoundError(f"Palette file not found: {palette_path}")

    with open(palette_path) as f:
        data = json.load(f)

    # Convert JSON format to internal format
    # JSON: {"palette_name": {"colors_rgb": [[R,G,B], ...], "description": "..."}}
    # Internal: {"palette_name": [(R,G,B), ...]}
    palettes = {}
    for name, config in data.items():
        if "colors_rgb" in config:
            # Convert arrays to tuples for PIL compatibility
            palettes[name] = [tuple(color) for color in config["colors_rgb"]]

    return palettes


def resolve_palette(name: str, palettes: dict) -> list:
    """Resolve palette name to color list.

    Args:
        name: Palette name (case-insensitive, spaces/dashes converted to underscores)
        palettes: Dictionary of palette_name → color_list from load_palettes()

    Returns:
        List of (R,G,B) tuples, or None if palette not found
    """
    # Normalize name: lowercase, replace spaces and dashes with underscores
    key = name.lower().replace(' ', '_').replace('-', '_')

    # Direct lookup
    if key in palettes:
        return palettes[key]

    # Try with common aliases
    if key in ("ui", "common_ui"):
        key = "ui_chrome"
        if key in palettes:
            return palettes[key]

    return None


def remove_background(img):
    """Remove background via alpha thresholding.

    Converts to RGBA if needed, sets pixels with alpha < 128 to fully transparent.
    """
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    data = np.array(img)
    alpha = data[:, :, 3]
    # Threshold: alpha < 128 → fully transparent
    alpha[alpha < 128] = 0
    data[:, :, 3] = alpha

    return Image.fromarray(data, 'RGBA')


def downscale(img, target_width):
    """Downscale to target pixel resolution using nearest-neighbor.

    Maintains aspect ratio. If image is already smaller, returns unchanged.
    """
    w, h = img.size
    if w <= target_width:
        return img

    scale = target_width / w
    new_h = int(h * scale)
    return img.resize((target_width, new_h), Image.NEAREST)


def apply_dithering(img, palette_colors):
    """Apply Floyd-Steinberg dithering with palette quantization.

    Args:
        img: PIL Image (RGB or RGBA)
        palette_colors: List of (R,G,B) tuples

    Returns:
        PIL Image with dithering applied, quantized to palette
    """
    # Convert to RGB for quantization
    if img.mode == 'RGBA':
        # Preserve alpha channel
        alpha = img.split()[3]
        rgb = img.convert('RGB')
    else:
        alpha = None
        rgb = img

    # Create palette image (1×N with palette colors)
    palette_img = Image.new('P', (len(palette_colors), 1))
    palette_data = []
    for r, g, b in palette_colors:
        palette_data.extend([r, g, b])
    palette_img.putpalette(palette_data)

    # Quantize with Floyd-Steinberg dithering
    quantized = rgb.quantize(palette=palette_img, dither=Image.FLOYDSTEINBERG)

    # Convert back to RGB
    result = quantized.convert('RGB')

    # Restore alpha if needed
    if alpha:
        result.putalpha(alpha)

    return result


def quantize_no_dither(img, palette_colors):
    """Apply palette quantization without dithering.

    Args:
        img: PIL Image (RGB or RGBA)
        palette_colors: List of (R,G,B) tuples

    Returns:
        PIL Image quantized to palette without dithering
    """
    if img.mode == 'RGBA':
        alpha = img.split()[3]
        rgb = img.convert('RGB')
    else:
        alpha = None
        rgb = img

    # Create palette image
    palette_img = Image.new('P', (len(palette_colors), 1))
    palette_data = []
    for r, g, b in palette_colors:
        palette_data.extend([r, g, b])
    palette_img.putpalette(palette_data)

    # Quantize without dithering
    quantized = rgb.quantize(palette=palette_img, dither=Image.NONE)
    result = quantized.convert('RGB')

    if alpha:
        result.putalpha(alpha)

    return result


def enhance_outlines(img, mode: OutlineMode, weight: int, palette_colors):
    """Apply outline enhancement.

    Args:
        img: PIL Image (RGBA)
        mode: OutlineMode enum value
        weight: Outline thickness (1-3)
        palette_colors: List of (R,G,B) tuples for dark color selection

    Returns:
        PIL Image with outlines enhanced
    """
    if mode == OutlineMode.NONE:
        return img

    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    data = np.array(img)
    alpha = data[:, :, 3]

    # Create edge mask from alpha channel
    edges = np.zeros_like(alpha, dtype=bool)
    edges[1:, :] |= (alpha[1:, :] > 0) & (alpha[:-1, :] == 0)  # top
    edges[:-1, :] |= (alpha[:-1, :] > 0) & (alpha[1:, :] == 0)  # bottom
    edges[:, 1:] |= (alpha[:, 1:] > 0) & (alpha[:, :-1] == 0)  # left
    edges[:, :-1] |= (alpha[:, :-1] > 0) & (alpha[:, 1:] == 0)  # right

    # Dilate edges for thickness
    if weight > 1 and SCIPY_AVAILABLE:
        edges = binary_dilation(edges, iterations=weight - 1)

    # Select outline color
    if mode == OutlineMode.DARK:
        # Use darkest color from palette
        outline_color = min(palette_colors, key=lambda c: sum(c))
    elif mode == OutlineMode.SINGLE:
        # Use first color in palette
        outline_color = palette_colors[0]
    elif mode == OutlineMode.CONTEXTUAL:
        # Use darkest color (same as DARK for now)
        outline_color = min(palette_colors, key=lambda c: sum(c))

    # Apply outline color
    data[edges] = (*outline_color, 255)

    return Image.fromarray(data, 'RGBA')


def clean_alpha(img):
    """Clean up alpha channel: fully opaque or fully transparent only.

    Thresholds semi-transparent pixels to either 0 or 255.
    """
    if img.mode != 'RGBA':
        return img

    data = np.array(img)
    alpha = data[:, :, 3]

    # Threshold: <128 → 0, >=128 → 255
    alpha[alpha < 128] = 0
    alpha[alpha >= 128] = 255

    data[:, :, 3] = alpha
    return Image.fromarray(data, 'RGBA')


def nearest_neighbor_upscale(img, scale: int):
    """Upscale using nearest-neighbor (preserves pixel structure).

    Args:
        img: PIL Image
        scale: Integer scale factor (e.g., 4 for 4×)

    Returns:
        Upscaled PIL Image
    """
    if scale <= 1:
        return img

    w, h = img.size
    return img.resize((w * scale, h * scale), Image.NEAREST)


def process_image(
    input_path,
    output_path,
    stream: StreamConfig,
    palette_colors: list,
    target_width: int = 320,
    upscale: int = 1,
    dither_override: bool = None,
    outline_override: OutlineMode = None,
    outline_weight_override: int = None
):
    """Complete VGA normalization pipeline.

    Args:
        input_path: Path to source image
        output_path: Path to save processed image
        stream: StreamConfig with pipeline settings
        palette_colors: List of (R,G,B) tuples for quantization
        target_width: Target pixel width for downscale (default 320)
        upscale: Final upscale factor (default 1 for no upscale)
        dither_override: Override stream dithering setting (optional)
        outline_override: Override stream outline mode (optional)
        outline_weight_override: Override stream outline weight (optional)
    """
    # Load image
    img = Image.open(input_path)

    # Step 1: Background removal (if enabled)
    if stream.remove_bg:
        img = remove_background(img)

    # Step 2: Downscale to pixel resolution
    img = downscale(img, target_width)

    # Step 3: Palette quantization + dithering
    dither = dither_override if dither_override is not None else stream.dithering
    if dither:
        img = apply_dithering(img, palette_colors)
    else:
        img = quantize_no_dither(img, palette_colors)

    # Step 4: Outline enhancement
    outline_mode = outline_override if outline_override is not None else stream.outline_mode
    outline_weight = outline_weight_override if outline_weight_override is not None else stream.outline_weight
    if outline_mode != OutlineMode.NONE:
        img = enhance_outlines(img, outline_mode, outline_weight, palette_colors)

    # Step 5: Alpha cleanup
    if img.mode == 'RGBA':
        img = clean_alpha(img)

    # Step 6: Upscale for display (optional)
    if upscale > 1:
        img = nearest_neighbor_upscale(img, upscale)

    # Save
    img.save(output_path)
    print(f"✓ Saved: {output_path}")


def batch_process(
    input_dir,
    output_dir,
    stream: StreamConfig,
    palette_colors: list,
    target_width: int = 320,
    upscale: int = 1
):
    """Process all PNG files in a directory.

    Recursively scans input_dir for *.png files, processes each,
    saves to output_dir with same relative path structure.
    """
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)

    if not input_dir.is_dir():
        print(f"ERROR: Input directory not found: {input_dir}")
        sys.exit(1)

    # Find all PNG files
    png_files = sorted(input_dir.rglob('*.png'))
    if not png_files:
        print(f"No PNG files found in {input_dir}")
        return

    print(f"Processing {len(png_files)} files from {input_dir}...")

    for input_path in png_files:
        # Compute relative path
        rel_path = input_path.relative_to(input_dir)
        output_path = output_dir / rel_path

        # Create output directory if needed
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Process
        process_image(
            input_path,
            output_path,
            stream,
            palette_colors,
            target_width,
            upscale
        )

    print(f"\n✓ Batch complete: {len(png_files)} files processed")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='VGA post-processing pipeline (Limner framework)',
        epilog='Part of Limner - A pixel art generation framework for VGA-era aesthetics'
    )

    # Input/output
    parser.add_argument('input', nargs='?', help='Input image path (or directory with --batch)')
    parser.add_argument('-o', '--output', help='Output path (file or directory)')
    parser.add_argument('--batch', action='store_true', help='Batch process directory')

    # Palette
    parser.add_argument('--palette', help='Palette name (e.g., seelie_groves, ui_chrome)')
    parser.add_argument('--palette-config', help='Path to palettes.json (optional, defaults to tools/config/palettes.json)')
    parser.add_argument('--list-palettes', action='store_true', help='List available palettes and exit')

    # Stream preset
    parser.add_argument('--stream', choices=['atmospheric', 'clean', 'hybrid'],
                       help='Rendering stream preset')

    # Pipeline overrides
    parser.add_argument('--target-width', type=int, default=320,
                       help='Target pixel width for downscale (default: 320)')
    parser.add_argument('--upscale', type=int, default=1,
                       help='Final upscale factor (default: 1, no upscale)')
    parser.add_argument('--dither', choices=['yes', 'no'],
                       help='Override stream dithering setting')
    parser.add_argument('--outline', choices=['none', 'dark', 'single', 'contextual'],
                       help='Override stream outline mode')
    parser.add_argument('--outline-weight', type=int, choices=[1, 2, 3],
                       help='Outline thickness (1-3)')

    args = parser.parse_args()

    # Load palettes
    try:
        palettes = load_palettes(args.palette_config)
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in palette file: {e}")
        sys.exit(1)

    # List palettes mode
    if args.list_palettes:
        print("Available palettes:")
        for name in sorted(palettes.keys()):
            colors = palettes[name]
            print(f"  {name} ({len(colors)} colors)")
        sys.exit(0)

    # Validate required arguments
    if not args.input:
        parser.error("Input path required (or use --list-palettes)")
    if not args.output:
        parser.error("Output path required (-o/--output)")
    if not args.palette:
        parser.error("Palette required (--palette)")
    if not args.stream:
        parser.error("Stream preset required (--stream)")

    # Resolve palette
    palette_colors = resolve_palette(args.palette, palettes)
    if not palette_colors:
        print(f"ERROR: Palette '{args.palette}' not found")
        print("Use --list-palettes to see available palettes")
        sys.exit(1)

    # Get stream config
    stream = STREAMS[args.stream]

    # Apply overrides
    dither_override = None
    if args.dither == 'yes':
        dither_override = True
    elif args.dither == 'no':
        dither_override = False

    outline_override = None
    if args.outline:
        outline_override = OutlineMode(args.outline)

    # Process
    if args.batch:
        batch_process(
            args.input,
            args.output,
            stream,
            palette_colors,
            args.target_width,
            args.upscale
        )
    else:
        process_image(
            args.input,
            args.output,
            stream,
            palette_colors,
            args.target_width,
            args.upscale,
            dither_override,
            outline_override,
            args.outline_weight
        )


if __name__ == '__main__':
    main()

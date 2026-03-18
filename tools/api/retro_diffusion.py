#!/usr/bin/env python3
"""
retro_diffusion.py — Retro Diffusion API client for pixel art generation.

Part of the Limner pixel art generation framework.

Wrapper for the Retro Diffusion API, a specialized diffusion model that produces
true grid-aligned pixel art natively. Supports palette enforcement, reference images,
and multiple generation tiers (RD_PRO, RD_PLUS, RD_FAST).

Usage:
  # Check remaining credits
  python tools/api/retro_diffusion.py --credits

  # Generate pixel art from Python
  from tools.api.retro_diffusion import RDClient, get_palette_base64

  client = RDClient(api_token="your_token_here")
  palette_b64 = get_palette_base64("seelie_groves")

  result = client.generate(
      prompt="elf warrior character sprite",
      width=256,
      height=256,
      style="rd_pro__default",
      input_palette=palette_b64,
      remove_bg=True
  )

  result.images[0].save("output.png")

API Documentation: https://api.retrodiffusion.ai/docs
"""

import argparse
import json
import sys
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional

import httpx

try:
    from PIL import Image
except ImportError:
    print("ERROR: Requires Pillow")
    print("  pip install Pillow")
    sys.exit(1)


def _load_palette_registry(palette_config_path: Optional[Path] = None) -> Dict:
    """Load palette registry from JSON config.

    Args:
        palette_config_path: Path to palettes.json. If None, uses default location
                            relative to this script (../../config/palettes.json from tools/api/)

    Returns:
        Dictionary mapping palette names to palette data:
        {
            "palette_name": {
                "base64": "base64_encoded_palette_png",
                "colors_rgb": [[R, G, B], ...],
                ...
            }
        }

    Raises:
        FileNotFoundError: If palette config file not found
        json.JSONDecodeError: If palette config is invalid JSON
    """
    if palette_config_path is None:
        # Default: tools/config/palettes.json (relative to this script)
        script_dir = Path(__file__).parent
        palette_config_path = script_dir.parent / "config" / "palettes.json"

    if not palette_config_path.exists():
        raise FileNotFoundError(
            f"Palette config not found: {palette_config_path}\n"
            f"Expected location: tools/config/palettes.json"
        )

    with open(palette_config_path) as f:
        return json.load(f)


def get_palette_base64(land: str, palette_registry: Optional[Dict] = None) -> Optional[str]:
    """Get base64-encoded palette PNG for a Land/palette name.

    Args:
        land: Palette name (e.g., "seelie_groves", "Seelie Groves", "seelie-groves")
        palette_registry: Optional pre-loaded palette registry. If None, loads from default config.

    Returns:
        Base64-encoded palette PNG string, or None if palette not found
    """
    if palette_registry is None:
        palette_registry = _load_palette_registry()

    # Normalize input: lowercase, replace spaces/hyphens with underscores
    key = land.lower().replace(" ", "_").replace("-", "_")

    # Check exact match first
    if key in palette_registry:
        return palette_registry[key].get("base64")

    # Try aliases for convenience (not SC-specific, just helpful shortcuts)
    aliases = {
        "seelie": "seelie_groves",
        "groves": "seelie_groves",
        "freemark": "freemark_reaches",
        "reaches": "freemark_reaches",
        "ironroot": "ironroot_holdings",
        "holdings": "ironroot_holdings",
        "shire": "shire_hearths",
        "hearths": "shire_hearths",
        "vaults": "vaults_precieux",
        "precieux": "vaults_precieux",
        "fenward": "fenward_commons",
        "commons": "fenward_commons",
        "mire": "mire_grok",
        "grok": "mire_grok",
        "scoria": "scoria_warrens",
        "warrens": "scoria_warrens",
        "temple": "temple_frozen",
        "frozen": "temple_frozen",
        "bottomless": "bottomless_satchel",
        "satchel": "bottomless_satchel",
        "ui": "ui_chrome",
        "chrome": "ui_chrome",
    }

    resolved = aliases.get(key, key)
    if resolved in palette_registry:
        return palette_registry[resolved].get("base64")

    return None


@dataclass
class GenerationResult:
    """Result from RD API generation.

    Attributes:
        images: List of PIL Image objects from generation
        credit_cost: Credits consumed by this generation
        remaining_credits: Credits remaining in account after generation
        raw_response: Full API response dict
    """
    images: List[Image.Image]
    credit_cost: float
    remaining_credits: float
    raw_response: dict


class RDClient:
    """Retro Diffusion API client.

    Handles authentication, request formatting, and response parsing for the
    Retro Diffusion pixel art generation API.

    Attributes:
        api_token: RD API token (from https://retrodiffusion.ai/dashboard)
        base_url: API base URL (default: https://api.retrodiffusion.ai/v1)
    """

    def __init__(self, api_token: str, base_url: str = "https://api.retrodiffusion.ai/v1"):
        """Initialize RD API client.

        Args:
            api_token: Your Retro Diffusion API token
            base_url: API base URL (defaults to production endpoint)
        """
        self.api_token = api_token
        self.base_url = base_url
        self.headers = {"X-RD-Token": api_token}

    def generate(
        self,
        prompt: str,
        width: int,
        height: int,
        style: str = "rd_pro__default",
        num_images: int = 1,
        input_palette: Optional[str] = None,
        reference_images: Optional[List[str]] = None,
        remove_bg: bool = False,
        seed: Optional[int] = None,
        bypass_prompt_expansion: bool = False,
        check_cost: bool = False
    ) -> GenerationResult:
        """Generate pixel art via RD API.

        Args:
            prompt: Description of asset to generate
            width: Output width in pixels
            height: Output height in pixels
            style: RD style preset (e.g., "rd_pro__fantasy", "rd_plus__skill_icon")
            num_images: Number of variations to generate (1-4)
            input_palette: Base64-encoded palette PNG for color enforcement
            reference_images: List of base64-encoded reference images (up to 9)
            remove_bg: Remove background for transparent sprites
            seed: Random seed for reproducible results
            bypass_prompt_expansion: Skip RD's built-in prompt enrichment
            check_cost: Preview cost without generating

        Returns:
            GenerationResult with images, credit cost, and remaining credits

        Raises:
            httpx.HTTPError: If API request fails
        """
        payload = {
            "width": width,
            "height": height,
            "prompt": prompt,
            "num_images": num_images,
            "prompt_style": style,
            "bypass_prompt_expansion": bypass_prompt_expansion,
            "check_cost": check_cost,
        }

        if input_palette:
            payload["input_palette"] = input_palette
        if reference_images:
            payload["reference_images"] = reference_images
        if remove_bg:
            payload["remove_bg"] = True
        if seed is not None:
            payload["seed"] = seed

        url = f"{self.base_url}/inferences"

        with httpx.Client(timeout=120.0) as client:
            response = client.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            data = response.json()

        # Parse base64 images to PIL Image objects
        images = []
        for b64_str in data.get("base64_images", []):
            img_bytes = BytesIO(b64_str.encode("utf-8"))
            images.append(Image.open(img_bytes))

        return GenerationResult(
            images=images,
            credit_cost=data.get("credit_cost", 0),
            remaining_credits=data.get("remaining_credits", 0),
            raw_response=data
        )

    def edit(
        self,
        image_base64: str,
        prompt: str,
        style: str = "rd_pro__default",
        mask_base64: Optional[str] = None,
        strength: float = 0.8,
        seed: Optional[int] = None
    ) -> GenerationResult:
        """Edit existing pixel art via RD API.

        Args:
            image_base64: Base64-encoded source image
            prompt: Description of desired changes
            style: RD style preset
            mask_base64: Optional base64-encoded mask (white = edit area)
            strength: Edit strength (0.0-1.0, higher = more change)
            seed: Random seed for reproducible results

        Returns:
            GenerationResult with edited images

        Raises:
            httpx.HTTPError: If API request fails
        """
        payload = {
            "image": image_base64,
            "prompt": prompt,
            "prompt_style": style,
            "strength": strength,
        }

        if mask_base64:
            payload["mask"] = mask_base64
        if seed is not None:
            payload["seed"] = seed

        url = f"{self.base_url}/inferences/edit"

        with httpx.Client(timeout=120.0) as client:
            response = client.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            data = response.json()

        # Parse base64 images to PIL Image objects
        images = []
        for b64_str in data.get("base64_images", []):
            img_bytes = BytesIO(b64_str.encode("utf-8"))
            images.append(Image.open(img_bytes))

        return GenerationResult(
            images=images,
            credit_cost=data.get("credit_cost", 0),
            remaining_credits=data.get("remaining_credits", 0),
            raw_response=data
        )

    def check_credits(self) -> Dict:
        """Check remaining API credits.

        Returns:
            Dict with "credits" (remaining) and "email" (account)

        Raises:
            httpx.HTTPError: If API request fails
        """
        url = f"{self.base_url}/inferences/credits"

        with httpx.Client(timeout=30.0) as client:
            response = client.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()

    def check_cost(
        self,
        width: int,
        height: int,
        style: str,
        num_images: int = 1
    ) -> Dict:
        """Preview generation cost without generating.

        Args:
            width: Output width in pixels
            height: Output height in pixels
            style: RD style preset
            num_images: Number of variations

        Returns:
            Dict with "credit_cost" (estimated credits)

        Raises:
            httpx.HTTPError: If API request fails
        """
        result = self.generate(
            prompt="cost check",
            width=width,
            height=height,
            style=style,
            num_images=num_images,
            check_cost=True
        )
        return {"credit_cost": result.credit_cost}


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Retro Diffusion API client (Limner framework)',
        epilog='Part of Limner - A pixel art generation framework for VGA-era aesthetics'
    )

    parser.add_argument('--token', help='RD API token (or set RD_API_TOKEN env var)')
    parser.add_argument('--credits', action='store_true', help='Check remaining credits')
    parser.add_argument('--palette-config', type=Path,
                       help='Path to palette config JSON (default: tools/config/palettes.json)')

    args = parser.parse_args()

    # Get API token from args or environment
    import os
    token = args.token or os.getenv('RD_API_TOKEN')
    if not token and args.credits:
        print("ERROR: API token required (--token or RD_API_TOKEN env var)")
        sys.exit(1)

    if args.credits:
        client = RDClient(token)
        info = client.check_credits()
        print(f"\nRemaining Credits: {info['credits']}")
        print(f"Account: {info['email']}\n")
    else:
        parser.print_help()


if __name__ == '__main__':
    main()

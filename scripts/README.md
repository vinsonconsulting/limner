# Scripts

Project-level automation scripts for asset generation.

## generate_scene.py

Retro Diffusion scene/environment generator for Summoning Chamber.

```bash
python scripts/generate_scene.py --land "seelie_groves" --type backdrop --output output/
```

Generates VGA-era pixel art scenes using the Retro Diffusion API. Reads palette definitions from `tools/config/palettes.json` and applies Land-specific color constraints.

## rd_bootstrap.py

Cold-start bootstrap sequence for Summoning Chamber asset generation.

```bash
python scripts/rd_bootstrap.py --config tools/config/palettes.json
```

Handles the full initialization sequence: API validation, style selection, palette loading, and test generation. Run this first when setting up a new generation environment.

## Dependencies

Both scripts require the packages in `requirements.txt`:

```bash
pip install -r requirements.txt
```

An active [Retro Diffusion API](https://retrodiffusion.ai) key is required for generation. Set it via environment variable or pass directly.

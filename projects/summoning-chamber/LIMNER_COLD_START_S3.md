# Limner Cold Start Briefing — Session 3

> Date: 2026-03-07
> Pipeline: Retro Diffusion (all assets) · vga_normalize.py (upscale only)
> Read this FIRST, then GRAPHIC_ASSETS_v3.md, then GENERATION_PATTERNS.md

---

## ◈ What Changed (Everything About the Pipeline)

### Pipeline: Radically Simplified

**Old (3-tool):**
```
Recraft API → vga_normalize.py (dither/outline/palette/downscale) → Aseprite CLI
```

**New (RD-native):**
```
Retro Diffusion API (palette + bg removal + dithering + outlines — all native)
    ↓
vga_normalize.py (nearest-neighbor upscale ONLY)
    ↓
validate_asset.py + check_palette.py (quality gates)
```

Recraft is dropped. Aseprite CLI is dropped. RD does the heavy lifting.

### UI: The Codex Model

The 11-step wizard is dead. Single-screen hub-and-spoke character sheet. Three views: Home, Codex, Settings. Default window: 1440×900.

### Characters: 10 Canonical Sprites

100-piece paperdoll eliminated. 10 full-body sprites + 10 portraits = 20 total character assets.

---

## ◈ YOUR FIRST TASK: Bootstrap (Day 0)

Style creation and validation is YOUR responsibility. Run the bootstrap script before generating any production assets.

### Step 1: Run the bootstrap

```bash
cd /path/to/summoning-chamber
export RD_API_KEY="your_key"

# Full bootstrap: creates palettes + 3 styles + 1 test image per style
python scripts/rd_bootstrap.py
```

This does three things:
1. **Generates 11 palette PNGs** in `palettes/` (one per Land + UI)
2. **Creates 3 custom RD Pro styles** via `POST /v1/styles`
3. **Runs 1 test generation per style** to validate output quality

### Step 2: Review test outputs

The script saves test images to `test_output/`:

| File | Style | What to Check |
|------|-------|---------------|
| `test_atmospheric_library.png` | sc_atmospheric | Heavy dithering? Atmospheric depth? Dark muted palette? |
| `test_clean_elf.png` | sc_clean | Zero dithering? Clean outlines? Flat color clusters? Transparent bg? |
| `test_hybrid_panel.png` | sc_hybrid | Light surface dithering? Contextual outlines? Manuscript feel? |

### Step 3: Adjust if needed

If a style is off, use the PATCH endpoint:

```python
import requests

style_id = "user__sc_clean_XXXX"  # from rd_style_ids.json
url = f"https://api.retrodiffusion.ai/v1/styles/{style_id}"
headers = {"X-RD-Token": API_KEY}

# Example: tighten the clean style
payload = {
    "llm_instructions": "...updated instructions...",
    "user_prompt_template": "...updated template...",
}

response = requests.patch(url, headers=headers, json=payload)
```

Or add a reference image later:

```python
payload = {
    "reference_images": [base64_encoded_screenshot],
}
response = requests.patch(url, headers=headers, json=payload)
```

### Step 4: Verify style IDs

After bootstrap, `rd_style_ids.json` contains:

```json
{
  "sc_atmospheric": "user__sc_atmospheric_XXXX",
  "sc_clean": "user__sc_clean_XXXX",
  "sc_hybrid": "user__sc_hybrid_XXXX"
}
```

Load this file at the start of every generation session. If it doesn't exist, run the bootstrap.

### Step 5: Record results

Log bootstrap outcomes in GENERATION_PATTERNS.md:
- Which test images passed visual inspection
- Which LLM instructions needed adjustment and what changed
- Effective seed values
- Any palette issues

**Only proceed to Sprint 1 after all 3 test images pass quality review.**

---

## ◈ Style Management (Ongoing Skill)

You own style lifecycle. Not just creation — management.

### When to Recreate Styles

```bash
# Delete and recreate all styles
python scripts/rd_bootstrap.py --recreate
```

Recreate when:
- LLM instructions need fundamental changes (not just tweaks — use PATCH for tweaks)
- RD updates their model and outputs shift
- Jim provides reference screenshots to embed

### When to PATCH Styles

Use PATCH for incremental adjustments:
- Tweaking `llm_instructions` wording after reviewing outputs
- Adding `reference_images` when screenshots become available
- Adjusting `min_width`/`min_height` for a specific asset batch
- Updating `user_prompt_template` based on what GENERATION_PATTERNS.md reveals

### Bootstrap Script Flags

```bash
rd_bootstrap.py                # Full: palettes + styles + test
rd_bootstrap.py --dry-run      # Preview payloads without API calls
rd_bootstrap.py --styles-only  # Create styles, skip test images
rd_bootstrap.py --test-only    # Regenerate tests (styles must exist)
rd_bootstrap.py --recreate     # Delete + recreate all styles
```

---

## ◈ Retro Diffusion API Reference

### Endpoints

| Endpoint | Method | Use |
|----------|--------|-----|
| `/v1/inferences` | POST | Generate images |
| `/v1/styles` | POST | Create custom style |
| `/v1/styles/{id}` | PATCH | Update style |
| `/v1/styles/{id}` | DELETE | Delete style |
| `/v1/edit` | POST | Edit existing image ($0.06/edit) |

### Three Custom Styles

| Key | Stream | For | BG Removal |
|-----|--------|-----|------------|
| `sc_atmospheric` | A | Backgrounds, tiles, maps | No |
| `sc_clean` | B | Characters, equipment, props, crests | Yes |
| `sc_hybrid` | C | UI chrome, furniture, decorative | No |

Style IDs are loaded from `rd_style_ids.json`. If the file doesn't exist, run bootstrap.

### Built-In Styles (Use Directly)

| Style | Use For | Why |
|-------|---------|-----|
| `rd_pro__ui_panel` | Interactive UI elements | Trained on UI layouts |
| `rd_plus__skill_icon` | Class icons ≤64px | Optimized for icon readability |
| `rd_plus__low_res` | Status icons ≤32px | Best at very small sizes |
| `rd_pro__inventory_items` | Equipment grid sheets | Diablo-style grid alignment |
| `rd_pro__spritesheet` | Batch same-style items | Multiple assets per generation |

### Key API Parameters

```python
payload = {
    "prompt": "...",                    # Subject + details (style handles mood)
    "width": 128,
    "height": 192,
    "num_images": 1,                    # Up to 4 for variant selection
    "prompt_style": "user__sc_clean_X", # From rd_style_ids.json or built-in
    "input_palette": "base64_png",      # From palettes/ directory
    "remove_bg": True,                  # Native transparency
    "seed": 1992,                       # Lock for reproducibility
    "tile_x": False,                    # Seamless horizontal tiling
    "tile_y": False,                    # Seamless vertical tiling
    "check_cost": False,                # True = estimate only, no generation
    "bypass_prompt_expansion": False,   # True = raw prompt, no LLM rewrite
    "reference_images": [],             # RD Pro only, up to 9 base64 images
}
```

### Palette Loading Helper

```python
import base64

def load_palette_b64(land_name):
    """Load a palette PNG as base64 for input_palette parameter."""
    path = f"palettes/pal_{land_name}.png"
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

# Usage:
palette = load_palette_b64("seelie")   # Land-specific
palette = load_palette_b64("ui")       # UI chrome
```

### Edit Endpoint (Targeted Fixes)

```python
url = "https://api.retrodiffusion.ai/v1/edit"
payload = {
    "prompt": "make the circlet more ornate",
    "input_image": base64_of_generated_image,
    "width": 128, "height": 192,
}
# $0.06 per edit — cheaper than full regeneration
```

### Prompting Rules

Custom styles have `user_prompt_template` that wraps your prompt. Your raw prompt should focus on SUBJECT + DETAIL:

```
# Good: specific subject, let the style handle mood
"Elf warrior, angular features, pointed ears, silver circlet, green hood"

# Bad: redundant style instructions (the custom style already says this)
"Dark medieval pixel art elf warrior with dithering and outlines..."
```

**DO include:** specific visual details, materials, proportions, pose
**DO NOT include:** style/mood instructions (handled by custom style)
**DO NOT include:** resolution specs (handled by width/height params)

---

## ◈ What's Still True (Locked Design)

### Visual Style: Hybrid (Darklands × Chrono Trigger × Hillsfar)

- Foreground = clean (CT). Background = atmospheric (DL). The CONTRAST is the style.

### Dark Palette Standard

All assets: "very dark", "blackened", "grim medieval", "weathered worn", "dark fantasy."

### Quality Gates (Every Asset)

- [ ] Correct style (sc_atmospheric / sc_clean / sc_hybrid / built-in)
- [ ] Correct palette PNG passed as input_palette
- [ ] `validate_asset.py` passes
- [ ] `check_palette.py` passes
- [ ] Silhouette readable at 50% (Stream B assets)
- [ ] No smooth gradients, anti-aliasing, modern lighting
- [ ] Transparency has clean pixel edges

---

## ◈ Sprint Plan

### Day 0: Bootstrap (THIS IS FIRST)

1. Run `rd_bootstrap.py` — creates palettes, styles, test images
2. Review 3 test outputs
3. PATCH any style that needs adjustment
4. Log results in GENERATION_PATTERNS.md
5. Confirm all 3 styles pass visual review

### Sprint 1: UI Chrome + Icons (39 assets)

| Day | Focus | Count | Style |
|-----|-------|-------|-------|
| 1 | Frame elements (borders, separators) | 8 | `sc_hybrid` |
| 2 | Interactive elements (cards, buttons) | 10 | `rd_pro__ui_panel` |
| 3–4 | Class icons + UI icons | 25 | `rd_plus__skill_icon` / `rd_plus__low_res` |
| 5 | Portrait frame + batch validation | 1+fixes | `sc_hybrid` |

### Sprint 2: Characters + Crests (40 assets)

| Day | Focus | Count | Style |
|-----|-------|-------|-------|
| 1 | Elf benchmark (quality gate) | 1 | `sc_clean` + pal_seelie |
| 2 | Remaining 9 sprites | 9 | `sc_clean` + per-land palettes |
| 3 | 10 portrait crops | 10 | `sc_clean` at 96×96 |
| 4–5 | 20 heraldic crests | 20 | `sc_clean` + per-land palettes |

### Sprint 3: Equipment + Settings + Polish (27 assets)

| Day | Focus | Count | Style |
|-----|-------|-------|-------|
| 1 | 8 equipment objects | 8 | `sc_clean` or `rd_pro__inventory_items` |
| 2 | Settings chrome | 8 | `rd_pro__ui_panel` |
| 3 | Decorative + fixes | 11 | `sc_hybrid` |

---

## ◈ Workflow Per Asset

```
1. LOAD style ID from rd_style_ids.json
2. LOAD palette PNG for the target Land (or pal_ui)
3. COMPOSE prompt: subject + details only (style handles mood)
4. GENERATE: POST /v1/inferences with num_images: 2-4
5. PICK best variant
6. VALIDATE: validate_asset.py + check_palette.py
7. If minor fix needed → /v1/edit ($0.06)
8. If major fail → regenerate with adjusted prompt
9. UPSCALE: vga_normalize.py --upscale 4 (nearest-neighbor)
10. SAVE to correct path per GRAPHIC_ASSETS_v3.md
11. DOCUMENT in GENERATION_PATTERNS.md (every result, pass or fail)
```

### Iteration Budget

- Target: 2–3 generations per approved asset
- Max: 5 before escalating to Jim
- Edit endpoint for small fixes (cheaper than regen)
- Pass approved assets as `reference_images` to lock style consistency within a batch

---

## ◈ Context Management

- `/clear` when switching Lands (palette context)
- `/clear` when switching streams (atmospheric ↔ clean ↔ hybrid)
- `/clear` after 5 consecutive generations
- Re-read relevant docs after every `/clear`
- Record every result in GENERATION_PATTERNS.md
- Use seed locking when iterating on same concept

---

## ◈ Files to Read Before Day 0

1. **This document** (done)
2. **GRAPHIC_ASSETS_v3.md** — full manifest with sizes, styles, palettes per asset
3. **GENERATION_PATTERNS.md** — prior learnings (adapt for RD)
4. **STYLE_BRIEF.md** — hybrid style rules (authoritative)
5. **CLAUDE.md** — identity + quality gates

Then run `rd_bootstrap.py` and begin.

---

*Cold start complete. Run bootstrap. Review tests. Begin production.*

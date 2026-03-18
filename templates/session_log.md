# Session Template

Copy this file for each new asset generation session:

```bash
cp templates/session_log.md sessions/$(date +%Y-%m-%d)_[asset_name].md
```

---

# Session: [DATE] — [ASSET NAME]

## Goal
[What we're creating — be specific about the asset and its purpose]

## Context
- **Asset Type:** [character / environment / prop / ui / heraldry / icon]
- **Palette:** [Palette name from palettes.json, or N/A]
- **Generation Tool:** [Retro Diffusion / PixelLab / MidJourney / other]
- **Stream/Style:** [e.g., atmospheric / clean / hybrid]
- **Target Size:** [e.g., 64×64, 128×128, 1920×1080]

---

## Iteration 1

### Prompt
```
[paste generation prompt]
```

### Parameters
| Parameter | Value |
|-----------|-------|
| Model/Tier | [e.g., RD_PRO, rd_plus__classic] |
| Reference Images | [list any reference images used] |
| Palette Enforcement | [yes/no — which palette] |
| Transparent BG | [yes/no] |

### Result
[Describe the output — what it looks like, what's good, what's wrong]

### Assessment
**Verdict:** [APPROVED / NEEDS REFINEMENT / REJECT]

**Compliance:**
| Element | ✓/✗ | Notes |
|---------|-----|-------|
| Palette | | |
| Pixel Art Feel | | |
| Dithering | | |
| Anachronisms | | |
| Lighting | | |

**Modular Asset Compliance (if applicable):**
| Element | ✓/✗ | Notes |
|---------|-----|-------|
| Transparent/neutral background | | |
| Consistent sizing/scale | | |
| Anchor points align | | |
| Palette-neutral for tinting | | |
| Clean edges for compositing | | |

### Notes
[What to change for next iteration]

---

## Iteration 2

### Changes Made
- [Change 1]
- [Change 2]

### Prompt
```
[paste refined prompt]
```

### Result
[Describe output]

### Assessment
**Verdict:** [APPROVED / NEEDS REFINEMENT]

### Notes
[...]

---

## Final Approval

### Winning Prompt
```
[The approved prompt — this is the institutional knowledge]
```

### Generation Details
- **Tool**: [generation tool + model/tier]
- **Job/Run ID**: [if available]
- **Credits/Cost**: [cost for this asset]

### Post-Processing
- [ ] Palette validated (`palette_check.py`)
- [ ] VGA compliance checked (`vga_validate.py`)
- [ ] Color mode verified (`png_validate.py`)
- [ ] Normalized/upscaled if needed (`vga_normalize.py`)

### Key Learnings
- [What worked well — specific phrases, parameters]
- [What to avoid next time]
- [Useful style anchors discovered]

### Cataloged
- [ ] Added to asset catalog as `[asset_id]`
- [ ] Learnings file updated

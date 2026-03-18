# Validation Report — [PROJECT NAME]

**Date**: [YYYY-MM-DD]
**Validator**: [Agent/person name]
**Scope**: [What was validated — e.g., "All deployed assets", "Session 5 batch"]

---

## Executive Summary

- **Total Files Scanned**: [N]
- **Pass Rate**: [N%]
- **Critical Issues**: [N]
- **Warnings**: [N]

---

## VGA Compliance (`vga_validate.py`)

| Asset | Resolution | Pixel Density | Dither Score | Verdict |
|-------|-----------|---------------|-------------|---------|
| [asset_path] | [WxH] | [score] | [score] | PASS/FAIL |

**Common Issues:**
- [List any patterns in failures]

---

## Palette Compliance (`palette_check.py`)

| Asset | Palette | Exact Matches | Near Matches | Off-Palette | Verdict |
|-------|---------|---------------|-------------|-------------|---------|
| [asset_path] | [palette_name] | [N] | [N] | [N] | PASS/FAIL |

**Off-Palette Colors Found:**
- [List specific colors and which assets contain them]

---

## Color Mode Check (`png_validate.py`)

| Metric | Count |
|--------|-------|
| RGB mode | [N] |
| Indexed mode | [N] |
| RGBA mode | [N] |
| Other | [N] |

**Recommendation:** [e.g., "Convert N files from RGB to indexed for 20-30% size savings"]

---

## File Integrity

| Check | Result |
|-------|--------|
| Duplicate files | [N found — list paths] |
| Zero-byte files | [N found] |
| Unexpected formats | [list any non-PNG/GIF] |
| Missing expected assets | [N — list] |

---

## Size Analysis

| Category | File Count | Total Size | Avg Size |
|----------|-----------|-----------|----------|
| [category] | [N] | [size] | [size] |
| **TOTAL** | **[N]** | **[size]** | **[size]** |

---

## Optimization Opportunities

1. [Opportunity — e.g., "RGB→indexed conversion could save X%"]
2. [Opportunity — e.g., "N duplicate files identified (XKB savings)"]
3. [Opportunity — e.g., "CSS `image-rendering: pixelated` required for display"]

---

## Action Items

- [ ] [Fix critical issue 1]
- [ ] [Fix critical issue 2]
- [ ] [Apply optimization 1]
- [ ] [Re-validate after fixes]

---

## Tools Used

```bash
# VGA compliance
python tools/pixel_art/vga_validate.py [asset_path]

# Palette check
python tools/pixel_art/palette_check.py [asset_path] --palette [name]

# Color mode validation
python tools/pixel_art/png_validate.py [directory]

# Asset inventory
python tools/inventory/asset_inventory.py --manifest [manifest.json] --root [project_dir]

# Directory scan
python tools/inventory/inventory_verify.py [directory]
```

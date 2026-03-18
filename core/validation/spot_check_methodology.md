# Spot-Check Methodology — Representative Asset Testing

> Efficient quality validation for large asset inventories through strategic sampling

## Overview

**Problem**: Validating hundreds of assets individually is time-consuming and creates feedback bottlenecks.

**Solution**: Test representative samples across asset categories. If samples pass, the category likely passes.

**Empirical Basis**: Session 13 (Summoning Chamber) validated 545 assets by testing 7 representatives — discovered systemic issues (color mode optimization) without full-scan overhead.

## When to Use Spot-Checking

### Good Candidates for Spot-Checking

✅ **Large batches** (50+ assets) with consistent generation parameters
✅ **Categorized assets** (icons, sprites, backgrounds) where each category has uniform specs
✅ **Post-generation validation** when assets share generation source (same API, same session)
✅ **MVP quality gates** where "good enough" > "perfect"
✅ **Optimization audits** (file size, color mode) where issues are non-critical

### Bad Candidates for Spot-Checking

❌ **Hero assets** (main character, key scenes) — validate individually
❌ **Final QA before production deploy** — full scan required
❌ **Critical compliance** (legal, brand requirements) — no sampling acceptable
❌ **Small batches** (<20 assets) — spot-check overhead exceeds full validation
❌ **High-variance assets** (each unique, custom-generated) — no representative samples

## Sampling Strategy

### Category-Based Sampling

Divide assets into **logical categories** based on generation method, specifications, or purpose.

**Example from Summoning Chamber** (545 assets):

| Category | Total Assets | Sample Size | Sample Selection Criteria |
|----------|--------------|-------------|---------------------------|
| Master Scenes | 10 | 1 | Canonical scene (most complex composition) |
| Land Backdrops | 10 | 1 | Mid-spectrum Land (not darkest, not brightest) |
| Character Sprites | 17 | 1 | Tier 1 canonical (highest detail) |
| Inventory Icons | 95 | 2 | One from each major subcategory (demeanor, nature) |
| UI Components | 60 | 1 | Most complex component (9-slice panel) |
| Heraldic Crests | 44 | 1 | Mid-complexity design |
| Map Assets | 16 | 0 | Small batch — full validation faster |

**Total**: 7 samples validate 545 assets (1.3% sampling rate)

### Sample Selection Principles

1. **One per category** — Each asset type should have at least one representative
2. **Complexity bias** — Choose more complex examples (if they pass, simpler ones likely pass)
3. **Mid-spectrum preference** — Avoid extremes (darkest/brightest, smallest/largest) unless extremes are the norm
4. **Known-good baseline** — If available, include one asset known to pass (control sample)
5. **Subcategory coverage** — For large categories, sample across subcategories

### Minimum Sample Sizes

| Total Assets | Minimum Samples | Sampling Rate |
|--------------|----------------|---------------|
| 10–50 | 3 | 6–30% |
| 51–100 | 5 | 5–10% |
| 101–250 | 7 | 3–7% |
| 251–500 | 10 | 2–4% |
| 500+ | 12–15 | 2–3% |

**Rule of thumb**: 5–10% sampling for small inventories, 2–3% for large inventories.

## Validation Workflow

### Step 1: Categorize Assets

Group assets by shared characteristics:

**Generation Method**:
- Same API endpoint, style preset, generation session
- Same resolution target
- Same color palette constraint

**Asset Specifications**:
- Same file format requirements
- Same resolution (e.g., all 64×64 icons)
- Same transparency requirements

**Functional Purpose**:
- UI components (buttons, panels, frames)
- Game content (sprites, items, environments)
- Metadata (crests, icons, badges)

### Step 2: Select Representatives

For each category:

1. **List all assets** in the category
2. **Identify complexity range** (simplest to most complex)
3. **Choose mid-to-high complexity sample** (biases toward harder cases)
4. **Ensure subcategory coverage** if category has internal divisions

**Example** (Inventory Icons — 95 total):

```
Category: Inventory Icons (95 assets)

Subcategories:
- Demeanor props (35) → Sample: formal-candle.png (mid-complexity)
- Nature props (37) → Sample: prop-analytical-chart.png (high-detail)
- Ambient props (13) → Sample: prop-creature-cat.png (organic shape)
- Equipment objects (10) → Sample: obj-crystal-ball.png (complex shading)

Selected: 4 samples (4.2% sampling rate)
```

### Step 3: Run Quality Gates

Apply all relevant validations to selected samples:

**VGA Compliance**:
```bash
python scripts/validate_asset.py path/to/sample1.png
python scripts/validate_asset.py path/to/sample2.png
# ... repeat for all samples
```

**Palette Compliance**:
```bash
python scripts/check_palette.py path/to/sample1.png --palette land_name
```

**Color Mode Check**:
```bash
python scripts/validate_png_colormode.py path/to/sample1.png
```

**File Format Validation**:
```bash
file path/to/sample1.png  # Check PNG vs GIF
identify -format "%[type] %[colorspace]\n" path/to/sample1.png  # Check indexed vs RGB
```

### Step 4: Analyze Results

**Pass/Fail by Category**:

| Category | Sample Asset | VGA Pass? | Palette Pass? | Color Mode | Notes |
|----------|--------------|-----------|---------------|------------|-------|
| Master Scenes | seelie_groves-scryer.png | ✅ | ✅ | RGB | Color mode suboptimal |
| Land Backdrops | ironroot-holdings-backdrop.png | ✅ | ✅ | RGB | Color mode suboptimal |
| Icons | formal-candle.png | ✅ | ✅ | RGB | Color mode suboptimal |
| Crests | class-scryer-128.png | ✅ | ✅ | P | Optimal |

**Systemic Issues** (affect entire categories):
- All samples show RGB color mode → **Entire inventory likely RGB** → Optimization opportunity
- All samples pass VGA compliance → **Inventory likely VGA-compliant** → No blocking issues
- All samples pass palette compliance → **Generation-time palette enforcement worked**

**Edge Cases** (unique to specific samples):
- Map base has 286 colors (vs 256 max) → Investigate this specific asset, not category-wide

### Step 5: Decide Action

**If all samples pass**:
- ✅ **Category validated** — Proceed with deployment
- 📝 **Document** — Record spot-check results in validation report
- ⏩ **Optional full scan** — Run if time permits, but not blocking

**If 1 sample fails**:
- 🔍 **Investigate** — Is this an edge case or systemic issue?
- 🧪 **Test 2–3 more** from the same category
- ✅ **If others pass** → Edge case, fix individually
- ❌ **If others fail** → Systemic issue, regenerate category

**If 2+ samples fail**:
- ❌ **Category failed** — Systemic issue identified
- 🔄 **Regenerate entire category** with corrected parameters
- 🔁 **Re-run spot-check** after regeneration

## Reporting Format

### Spot-Check Validation Report Template

```markdown
# Spot-Check Validation Report

**Date:** YYYY-MM-DD
**Total Assets:** XXX files
**Samples Tested:** XX files (X.X% sampling rate)
**Validator:** [Script/Person]

## Categories Tested

### Category 1: [Name] (XX assets)
- **Sample:** path/to/sample.png
- **VGA Compliance:** ✅ Pass / ⚠️ Warning / ❌ Fail
- **Palette Compliance:** ✅ Pass / ⚠️ Warning / ❌ Fail
- **Color Mode:** P (indexed) / RGB / RGBA
- **Notes:** [Any observations]

### Category 2: [Name] (XX assets)
...

## Summary

**Passed Categories:** X/X
**Failed Categories:** X/X
**Warnings (non-blocking):** X categories

**Systemic Issues Identified:**
- [Issue 1: Description and scope]
- [Issue 2: Description and scope]

**Edge Cases (individual assets):**
- [Asset path]: [Issue description]

**Recommendations:**
- [ ] Action item 1
- [ ] Action item 2
```

### Example Report (Summoning Chamber Session 13)

```markdown
# Spot-Check Validation Report

**Date:** 2026-02-15
**Total Assets:** 545 files
**Samples Tested:** 7 files (1.3% sampling rate)
**Validator:** validate_asset.py + validate_png_colormode.py

## Categories Tested

### Master Scenes (10 assets)
- **Sample:** seelie_groves-scryer.png
- **VGA Compliance:** ✅ Pass
- **Palette Compliance:** ✅ Pass
- **Color Mode:** RGBA
- **Notes:** Color values correct, storage format suboptimal

### Land Backdrops (10 assets)
- **Sample:** ironroot-holdings-backdrop.png
- **VGA Compliance:** ✅ Pass
- **Palette Compliance:** ✅ Pass
- **Color Mode:** RGBA
- **Notes:** Atmospheric dithering present and correct

### Character Sprites (17 assets)
- **Sample:** elf-scryer.png
- **VGA Compliance:** ✅ Pass
- **Palette Compliance:** ✅ Pass
- **Color Mode:** RGBA
- **Notes:** Hard edges, no dithering (correct for sprites)

### Inventory Icons (95 assets)
- **Sample 1:** formal-candle.png (Demeanor)
- **Sample 2:** prop-analytical-chart.png (Nature)
- **VGA Compliance:** ✅ Pass (both)
- **Palette Compliance:** ✅ Pass (both)
- **Color Mode:** RGBA (both)
- **Notes:** Clean silhouettes, transparent backgrounds correct

### UI Components (60 assets)
- **Sample:** panel-card-frame.png
- **VGA Compliance:** ✅ Pass
- **Palette Compliance:** ✅ Pass (UI Chrome palette)
- **Color Mode:** RGBA
- **Notes:** 9-slice structure preserved

### Heraldic Crests (44 assets)
- **Sample:** class-scryer-128.png
- **VGA Compliance:** ✅ Pass
- **Palette Compliance:** ✅ Pass
- **Color Mode:** P (indexed) ✅
- **Notes:** Optimal — indexed color used

### Map Assets (16 assets)
- **Sample:** map-base.png
- **VGA Compliance:** ⚠️ Warning (286 colors vs 256 max)
- **Palette Compliance:** ⚠️ Near-compliant (colors look correct)
- **Color Mode:** RGBA
- **Notes:** Edge case — visual quality acceptable for MVP

## Summary

**Passed Categories:** 7/7
**Failed Categories:** 0/7
**Warnings (non-blocking):** 1 asset (map base palette count)

**Systemic Issues Identified:**
- **Color mode optimization opportunity**: 531/541 PNGs use RGB/RGBA instead of indexed
  - Impact: File size 20-30% larger than necessary
  - Severity: Non-blocking (optimization, not compliance)
  - Action: Post-MVP batch conversion to indexed color

**Edge Cases (individual assets):**
- `map-base.png`: 286 colors (vs 256 max) — colors visually correct, technically over limit
  - Action: Document as known issue, acceptable for MVP

**Recommendations:**
- ✅ **Deploy all 545 assets** — VGA compliance confirmed
- 📋 **Post-MVP optimization** — Batch convert RGB/RGBA → indexed (20-30% file size reduction)
- 🔍 **Map base regeneration** — Optional fix for palette count (non-critical)
```

## Limitations & Risks

### What Spot-Checking Catches

✅ **Systemic issues** affecting entire categories (wrong palette, wrong generation preset)
✅ **Configuration errors** (incorrect resolution, wrong file format)
✅ **Quality drift** across batches (style preset changes, API updates)
✅ **Optimization opportunities** (color mode, file size patterns)

### What Spot-Checking Misses

❌ **Individual edge cases** (1 bad asset among 100 good ones)
❌ **Rare combinations** (specific palette + specific content = bad output)
❌ **Subtle variations** (slight color drift, minor dithering inconsistencies)
❌ **File corruption** (unless sample happens to be corrupted)

### Risk Mitigation Strategies

**1. Increase sample size** if category shows variance:
- Start with 1–2 samples per category
- If failures occur, test 3–5 more from that category
- Full scan only if >50% of expanded sample fails

**2. Use multiple validators**:
- Automated scripts (validate_asset.py, check_palette.py)
- Manual visual inspection (side-by-side comparison grid)
- User acceptance testing (select 5–10 for end-user review)

**3. Combine with random audits**:
- Spot-check validates categories
- Random audit catches individual failures
- Example: Test 10 random assets outside of spot-check samples

**4. Accept calculated risk**:
- Spot-checking is a trade-off: speed vs certainty
- For MVP: 95% confidence acceptable
- For production: 99%+ confidence may require full scan

## Integration with Other Validations

Spot-checking is **one layer** of quality assurance:

| Validation Type | Scope | When to Use |
|----------------|-------|-------------|
| **Spot-Check** | Category-level sampling | Post-generation batch validation |
| **Full Scan** | Every asset individually | Final QA before production deploy |
| **Random Audit** | Statistical sampling | Ongoing quality monitoring |
| **Manual Review** | User acceptance testing | Hero assets, key visuals |
| **Automated CI/CD** | Every commit/deploy | Continuous validation |

**Workflow Integration**:

1. **Generation** → Create assets in batches
2. **Spot-Check** → Validate categories via samples (this methodology)
3. **Fix Systemic Issues** → Regenerate failed categories
4. **Random Audit** → Test 5–10 random assets for edge cases
5. **Full Scan** (optional) → Run before critical milestones
6. **Deploy** → Ship validated assets

## Tools & Scripts

### Spot-Check Script Example

```python
#!/usr/bin/env python3
"""Run spot-check validation across asset categories."""

import subprocess
from pathlib import Path

# Define categories and sample assets
SPOT_CHECK_SAMPLES = {
    "Master Scenes": ["static/assets/scenes/seelie_groves-scryer.png"],
    "Land Backdrops": ["static/assets/lands/ironroot-holdings-backdrop.png"],
    "Icons": [
        "static/assets/icons/demeanor/formal-candle.png",
        "static/assets/icons/props/nature/prop-analytical-chart.png"
    ],
    "Crests": ["static/assets/icons/classes/class-scryer-128.png"],
}

def run_spot_check():
    """Execute spot-check validation."""
    results = {}

    for category, samples in SPOT_CHECK_SAMPLES.items():
        print(f"\n=== {category} ({len(samples)} samples) ===")
        category_results = []

        for sample in samples:
            if not Path(sample).exists():
                print(f"⚠️  Sample not found: {sample}")
                continue

            # Run validators
            vga_result = subprocess.run(
                ["python", "scripts/validate_asset.py", sample],
                capture_output=True
            )

            colormode_result = subprocess.run(
                ["python", "scripts/validate_png_colormode.py", sample],
                capture_output=True
            )

            passed = vga_result.returncode == 0
            category_results.append({
                "sample": sample,
                "vga_pass": passed,
                "color_mode": colormode_result.stdout.decode()
            })

            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"{status} — {sample}")

        results[category] = category_results

    return results

if __name__ == "__main__":
    results = run_spot_check()

    # Generate summary
    total_categories = len(results)
    passed_categories = sum(
        1 for cat_results in results.values()
        if all(r["vga_pass"] for r in cat_results)
    )

    print(f"\n{'='*50}")
    print(f"Spot-Check Summary: {passed_categories}/{total_categories} categories passed")
    print(f"{'='*50}")
```

### Validation Commands Reference

```bash
# VGA compliance spot-check
python scripts/validate_asset.py path/to/sample.png

# Palette compliance spot-check
python scripts/check_palette.py path/to/sample.png --palette land_name

# Color mode check
python scripts/validate_png_colormode.py path/to/sample.png

# Batch spot-check with custom samples
python scripts/spot_check.py --samples samples.json

# Generate spot-check report
python scripts/spot_check.py --report
```

## Best Practices

### DO

✅ **Document sample selection criteria** — Explain why each sample was chosen
✅ **Test across subcategories** — Ensure coverage within large categories
✅ **Bias toward complexity** — If complex samples pass, simple ones likely pass
✅ **Record systemic patterns** — Note issues affecting entire categories
✅ **Escalate to full scan** — When spot-check reveals >20% failure rate

### DON'T

❌ **Cherry-pick samples** — Don't only test assets you know will pass
❌ **Skip categories** — Every category needs at least one sample
❌ **Ignore warnings** — Non-blocking issues today may block later
❌ **Assume uniformity** — High-variance categories need larger samples
❌ **Skip documentation** — Record which samples were tested and why

## Example Use Cases

### Use Case 1: MVP Asset Validation (Summoning Chamber)

**Context**: 545 assets generated across 12 sessions, ready for deployment.

**Challenge**: Full validation would take hours; MVP launch blocked on quality confirmation.

**Solution**:
1. Categorized assets into 7 groups
2. Selected 7 representative samples (1.3% sampling)
3. Ran VGA compliance + palette compliance + color mode check
4. Identified systemic issue (RGB color mode) as optimization opportunity
5. Validated all categories passed VGA compliance
6. **Deployment unblocked** — shipped all 545 assets with confidence

**Result**: 7 samples validated 545 assets in ~15 minutes (vs 3+ hours for full scan)

### Use Case 2: Icon Batch Validation

**Context**: 95 inventory icons generated in 3 batches.

**Challenge**: Icons have 4 subcategories (demeanor, nature, ambient, equipment).

**Solution**:
1. Selected 1 sample per subcategory (4 total)
2. Validated silhouette clarity at 64×64 native size
3. Checked transparent backgrounds for fringe artifacts
4. Confirmed VGA compliance (hard edges, no anti-aliasing)
5. All 4 samples passed → Entire 95-icon inventory validated

**Result**: 4 samples (4.2% sampling) confirmed quality across all subcategories

### Use Case 3: Regeneration Decision

**Context**: Land backdrops generated with new style preset.

**Challenge**: Unsure if new preset maintains VGA compliance.

**Solution**:
1. Spot-check tested 2 of 10 backdrops
2. Both showed smooth gradients (VGA violation)
3. Regenerated entire batch with corrected preset
4. Re-ran spot-check on 2 samples → Both passed
5. Deployed all 10 backdrops

**Result**: Caught systemic issue early, avoided deploying 10 non-compliant assets

---

*This methodology is project-agnostic. Adapt sampling strategy and validation tools to your specific asset types and quality requirements.*

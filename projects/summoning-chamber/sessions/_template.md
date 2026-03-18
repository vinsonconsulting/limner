# Session Template

Copy this file for each new asset session:

```bash
cp sessions/_template.md sessions/$(date +%Y-%m-%d)_[asset_name].md
```

---

# Session: [DATE] — [ASSET NAME]

## Goal
[What we're creating]

## Context
- **Asset Type:** [character / environment / prop / ui / heraldry]
- **Land:** [Land name or N/A]
- **Class:** [Class name or N/A]

---

## Iteration 1

### Prompt
```
[paste MidJourney prompt]
```

### Result
[Describe the MidJourney output — what it looks like, what's good, what's wrong]

### Assessment
**Verdict:** [APPROVED / NEEDS REFINEMENT]

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
[The approved prompt]
```

### MidJourney Job ID
[If available]

### Key Learnings
- [What worked well]
- [What to avoid next time]
- [Useful style anchors discovered]

### Cataloged
- Added to [[output/asset_catalog]] as `[asset_id]`

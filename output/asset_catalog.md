# Summoning Chamber Asset Catalog

> Approved visual assets. Maintained by Limner.

---

## Catalog Format

Each approved asset gets an entry like this:

```markdown
---
asset_id: [snake_case_name]
asset_type: [see Asset Types below]
land: [land_name or null]
class: [class_name or null]
created: [ISO8601 timestamp]
status: approved
midjourney_job: [job ID if available]
iterations: [number]
tags: ["tag1", "tag2"]
---
```

### Asset Types

| Type | Description |
|------|-------------|
| `character` | Complete character (reference only) |
| `body_part` | Paper doll component (legs, torso, arms, head) |
| `accessory` | Class-driven equipment for paper doll |
| `environment` | Complete scene (reference only) |
| `backdrop` | Land background layer (modular) |
| `furniture_overlay` | Class furniture layer (modular) |
| `prop` | Individual item, inventory art |
| `clickable_object` | Interactive scene object |
| `ui` | Interface element (button, frame, panel) |
| `heraldry` | Land crest or emblem |
| `map_region` | Land of Origin map territory |
| `card` | Class selection card |

```markdown

## [Asset Name]

### Final Prompt
\```
[The winning MidJourney prompt]
\```

### Key Learnings
- [What worked]
- [What to remember for similar assets]

### Session
[[sessions/YYYY-MM-DD_asset_name]]
```

---

## Assets

<!-- Approved assets below this line -->

### summoner_null_backdrop_splash_chamber_v1

```yaml
asset_id: summoner_null_backdrop_splash_chamber_v1
asset_type: backdrop
land: null
class: null
created: 2026-03-11
status: approved
tool: Retro Diffusion API (RD_CLASSIC + rd_plus__environment)
iterations: 9 (5 chamber + 4 bigroom)
cost: $0.27 total ($0.03/image)
native_size: 360x225
final_size: 1440x900 (4x nearest-neighbor upscale)
tags: ["splash screen", "summoning chamber", "cathedral scale", "arcane"]
```

#### Final Prompt
```
Interior of enormous cavernous castle great hall seen from far back, cathedral-scale vaulted stone ceiling towering high overhead lost in darkness, tiny glowing summoning circle platform on distant floor far ahead, rows of massive stone pillars receding into deep perspective, vast open stone floor stretching forward, distant walls barely visible in dim torchlight, iron chandelier chains hanging from unseen ceiling, extreme sense of scale and emptiness, dwarfing architecture, weathered worn blackened medieval stonework, crumbling ancient, very dark interior, grim medieval atmosphere, dark fantasy, VGA pixel art, 320x200 aesthetic, dithered shading, visible pixels, Darklands 1992 inspired, DOS game background scene, no characters
```

#### Key Learnings
- "Cathedral-scale" + "seen from far back" + "tiny glowing" creates genuine sense of enormous space
- Deep perspective language ("receding into", "distant", "far ahead") more effective than just "vast" or "huge"
- 16-color custom palette (dark stone + arcane purple + torch amber) enforces Dark Palette Standard without over-constraining
- RD_CLASSIC at $0.03/image = 3x cheaper than old RD_PLUS pipeline — batch exploration is now trivial
- 360x225 native → 1440x900 at 4x is a clean pipeline for non-standard splash dimensions

#### Session
2026-03-11 — inline session (no separate session file)

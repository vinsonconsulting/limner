# [PROJECT NAME] — Art Direction Brief

## Overview
[1-2 sentence description of the project and its visual style]

## Visual North Star
- **Era**: [e.g., 1990-1993 VGA DOS games]
- **Primary Influence**: [e.g., Darklands (1992) for scenes/atmosphere]
- **Secondary Influence**: [e.g., Hillsfar (1989) for portraits/UI]
- **Palette System**: [e.g., 256-color maximum, custom per region]

## Project Constraints (Non-Negotiable)

- **Palette**: [constraint — e.g., 256-color maximum per palette]
- **Palette Tone**: [constraint — e.g., Dark, "blackened, grim medieval"]
- **Dithering**: [constraint — e.g., Floyd-Steinberg where appropriate]
- **Resolution Feel**: [constraint — e.g., 320×200 aesthetic, visible pixels]
- **Display Target**: [constraint — e.g., 1920×1080]
- **Forbidden**: [list — e.g., smooth gradients, soft shadows, anti-aliasing, modern lighting]

## Generation Tools

| Priority | Tool | Role | Best For |
|----------|------|------|----------|
| Primary | [tool] | [role] | [use case] |
| Post-processing | [tool] | [role] | [use case] |
| Validation | Limner toolkit | Quality gates | Palette + VGA compliance |

## Palette Registry

Palettes are defined in `tools/config/palettes.json`. Each palette includes:
- RGB color values
- Base64-encoded swatch PNG
- Palette name/alias

### Available Palettes
[List your project's palettes — e.g.:]
| Palette | Colors | Usage |
|---------|--------|-------|
| [name] | [N] | [what it's used for] |

## Asset Types

| Type | Size | Palette | Notes |
|------|------|---------|-------|
| [type] | [WxH] | [palette] | [generation notes] |

## Naming Convention

```
{region}_{role}_{asset_type}_{descriptor}_v{version}
```

| Component | Values | Notes |
|-----------|--------|-------|
| `{region}` | [list] | [guidance] |
| `{role}` | [list] | [guidance] |
| `{asset_type}` | [list] | [guidance] |

## Style Anchors (Always Include)

Every generation prompt must include:
```
[list your project's required style keywords]
```

## Negative Prompts (Always Exclude)

```
[list your project's banned keywords/styles]
```

## Banned Keywords

| Keyword | Reason | Alternative |
|---------|--------|-------------|
| [word] | [what it triggers] | [use this instead] |

## Must-Include Anchors

| Anchor | Purpose |
|--------|---------|
| [phrase] | [why it's needed] |

## Quality Gates

All assets must pass before deployment:

1. **VGA Compliance** — `python tools/pixel_art/vga_validate.py [asset]`
2. **Palette Compliance** — `python tools/pixel_art/palette_check.py [asset] --palette [name]`
3. **Color Mode** — `python tools/pixel_art/png_validate.py [directory]`

## Directory Structure

```
[your project's asset directory layout]
```

## Reference Documents

| Document | Purpose |
|----------|---------|
| [path] | [what it contains] |

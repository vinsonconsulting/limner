# Developer Handoff Workflow

## Purpose

The Developer Handoff workflow bridges asset generation (Limner's domain) with UI integration (developer's domain). After assets pass post-generation validation, developers need comprehensive context to integrate them correctly into the application.

This workflow produces documentation that answers:
- What assets exist and where are they located?
- How should paths be constructed programmatically?
- What are the known issues and gotchas?
- What are the integration priorities?
- What CSS/styling requirements preserve visual quality?

**Prerequisites**: [Post-Generation Validation](post_generation_validation.md) must complete successfully.

**Outputs**:
- `DEV_HANDOFF.md` or `INTEGRATION_GUIDE.md` — comprehensive integration documentation
- `ASSET_OPTIMIZATION_REPORT.md` (optional) — quality analysis with non-blocking issues
- Updated project README with asset achievements

---

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Developer Handoff Workflow                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: Asset Inventory Documentation                     │
│  ├─ Complete category breakdown (counts, paths)            │
│  ├─ Directory structure with naming conventions            │
│  └─ File format summary (PNG/GIF, dimensions)              │
│                                                             │
│  Phase 2: Integration Context                               │
│  ├─ Path helper examples (TypeScript/JavaScript)           │
│  ├─ Component integration patterns (framework-specific)    │
│  ├─ CSS requirements (image-rendering, z-index)            │
│  └─ Layer composition system (if applicable)               │
│                                                             │
│  Phase 3: Known Issues & Gotchas                            │
│  ├─ Naming convention inconsistencies                      │
│  ├─ Missing assets or gaps                                 │
│  ├─ Rendering artifacts and fixes                          │
│  └─ Browser compatibility notes                            │
│                                                             │
│  Phase 4: Integration Priorities                            │
│  ├─ Critical path (blocks MVP launch)                      │
│  ├─ High priority (enhances MVP)                           │
│  └─ Low priority (post-MVP)                                │
│                                                             │
│  Phase 5: Optimization Opportunities                        │
│  ├─ File size reduction (indexed color, compression)       │
│  ├─ Performance improvements (preloading, lazy loading)    │
│  └─ Directory cleanup (duplicate removal)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Asset Inventory Documentation

### 1.1 Generate Category Breakdown

Create comprehensive inventory table showing all asset categories with counts and paths.

**Script**: `verify_asset_inventory.py` (see [Asset Inventory Workflow](asset_inventory.md))

**Expected Output**:
```
Asset Inventory Report
======================

Core Scenes (1920×1080):
  Master Scenes:     10 files  → static/assets/scenes/
  Land Backdrops:    10 files  → static/assets/lands/{land}/backdrop.png
  Class Overlays:    11 files  → static/assets/classes/{class}/overlay.png
  Environments:       2 files  → static/assets/environments/

Characters:
  Canonical Sprites: 10 files  → static/assets/characters/{denizen}/{denizen}-{class}.png
  Variants:           7 files  → static/assets/characters/...
  Paper Doll Parts: ~100 files → static/assets/characters/{denizen}/{part}_*.png

Icons & Crests (161 files):
  Inventory Props:   95 files  → static/assets/icons/props/**/*.png
  Class Crests:      22 files  → static/assets/icons/classes/*-crest*.png
  Land Crests:       22 files  → static/assets/lands/{land}/crest*.png
  Status Icons:       6 files  → static/assets/icons/status/*.{png,gif}
  Tool Icons:         6 files  → static/assets/icons/tools/*.png
  Action Icons:      10 files  → static/assets/icons/actions/*.png

UI Components (60 files):
  Chrome:            10 files  → static/assets/ui/chrome/*.png
  Buttons:           12 files  → static/assets/ui/buttons/*.png
  Forms:             15 files  → static/assets/ui/forms/*.png
  Navigation:        11 files  → static/assets/ui/navigation/*.png
  Chat:               9 files  → static/assets/ui/chat/*.png
  Panels:            12 files  → static/assets/ui/panels/*.png

Map Assets (16 files):
  Base/Chrome:        5 files  → static/assets/map/{base,border,compass,...}.png
  Region Highlights: 11 files  → static/assets/map/regions/*.png

TOTAL: 545 PNG/GIF files
```

### 1.2 Document Directory Structure

Create tree view showing complete organization with naming conventions.

**Command**:
```bash
tree -d -L 3 static/assets/ > docs/asset_directory_tree.txt
```

**Include in Documentation**:
```
static/assets/
├── ui/
│   ├── chrome/      # Logo, favicon, spinner, background
│   ├── buttons/     # All states (default, hover, active, disabled)
│   ├── forms/       # Input, dropdown, checkbox, radio, slider
│   ├── navigation/  # Arrows, steps, close, menu, back
│   ├── chat/        # Bubbles, send, typing, scroll
│   └── panels/      # Frames, cards, modals, tooltips, dividers
├── lands/
│   ├── {land-name}/        # Kebab-case convention (e.g., seelie-groves)
│   │   ├── backdrop.png    # 1920×1080 environment background
│   │   ├── crest.png       # 128×128 heraldic crest
│   │   └── crest-small.png # 48×48 heraldic crest
│   └── ... (10 lands total)
├── classes/
│   ├── {class}/            # Kebab-case convention (e.g., scryer)
│   │   ├── overlay.png     # 1920×1080 furniture arrangement
│   │   └── icon.png        # 64×64 class icon
│   └── ... (11 classes total)
├── characters/
│   ├── {denizen-type}/     # Kebab-case (e.g., elf, dwarf, smallfolk)
│   │   ├── {denizen}-{class}.png  # Full sprites (256×256)
│   │   ├── head_*.png             # Paper doll parts (if used)
│   │   ├── torso_*.png
│   │   ├── arms_*.png
│   │   └── legs_*.png
│   └── ... (10 denizen types)
├── scenes/
│   └── {land}-{class}.png  # Master scenes (1920×1080)
│       # Example: seelie_groves-scryer.png (note: underscore in land, dash before class)
├── icons/
│   ├── props/
│   │   ├── demeanor/   # Formal, casual, professional indicators
│   │   ├── nature/     # Analytical, creative, cautious, etc.
│   │   └── ambient/    # Creatures, lighting, easter eggs
│   ├── classes/        # Class crests and icons
│   ├── status/         # Thinking, researching, idle, error, connected, disconnected
│   ├── tools/          # Search, drive, slack, github, code, upload
│   └── actions/        # Save, export, import, edit, delete, copy, settings, help, info, warning
├── equipment/
│   └── *.png           # 64×64 equipment object icons
├── map/
│   ├── base.png        # Map base layer
│   ├── border.png      # Ornate frame
│   ├── compass.png     # Compass rose
│   ├── labels.png      # Region labels
│   ├── legend.png      # Map legend
│   └── regions/
│       └── *.png       # Region highlight overlays
└── environments/
    ├── summoning-chamber.png  # 1920×1080 welcome/creation screen
    └── council-chamber.png     # 1920×1080 multi-agent mode
```

### 1.3 File Format Summary

Document technical specifications for each asset category.

**Template**:
```markdown
## File Format Specifications

### Core Scenes
- **Format**: PNG (transparent where applicable)
- **Dimensions**: 1920×1080 (display target)
- **Color Mode**: Prefer indexed (P/PA), acceptable RGB/RGBA
- **Transparency**: Clean pixel edges, no fringe artifacts
- **Naming**: kebab-case for directories, mixed for files (see gotchas)

### Characters
- **Format**: PNG with transparency
- **Dimensions**: 256×256 (full sprites), varies (paper doll parts)
- **Color Mode**: Indexed (P/PA) strongly preferred
- **Transparency**: Required, clean edges critical for compositing
- **Naming**: `{denizen}-{class}.png` (e.g., elf-scryer.png)

### Icons
- **Format**: PNG with transparency, GIF for animations
- **Dimensions**: 64×64 (standard), 128×128 and 48×48 (crests)
- **Color Mode**: Indexed (P) for static, RGB for animations
- **Transparency**: Required, clean silhouettes
- **Naming**: Descriptive kebab-case (e.g., formal-candle.png)

### UI Components
- **Format**: PNG with transparency
- **Dimensions**: Varies by component (16×16 to 200×100)
- **Color Mode**: Indexed (P/PA) preferred
- **Transparency**: Required for overlays, optional for panels
- **Naming**: Component type + state (e.g., button-hover.png)

### Map Assets
- **Format**: PNG
- **Dimensions**: 1400×800 (base), 1500×900 (border), varies (regions)
- **Color Mode**: Indexed preferred
- **Transparency**: Required for region highlights, optional for base
- **Naming**: Descriptive (base.png, compass.png, region-{land}.png)
```

---

## Phase 2: Integration Context

### 2.1 Path Helper Examples

Provide code examples for constructing asset paths programmatically.

**TypeScript/JavaScript Examples** (SvelteKit, Next.js, etc.):

```typescript
// src/lib/services/scene.ts

/**
 * Path helpers for asset access
 * All paths relative to /static/assets/ (publicly accessible)
 */

// Land Assets
export function getLandBackdropPath(landId: string): string {
  return `/assets/lands/${landId}/backdrop.png`;
}

export function getLandCrestPath(landId: string, size: 'large' | 'small' = 'large'): string {
  const filename = size === 'large' ? 'crest.png' : 'crest-small.png';
  return `/assets/lands/${landId}/${filename}`;
}

// Class Assets
export function getClassOverlayPath(classId: string): string {
  return `/assets/classes/${classId}/overlay.png`;
}

export function getClassIconPath(classId: string): string {
  return `/assets/classes/${classId}/icon.png`;
}

export function getClassCrestPath(classId: string, size: 128 | 48 = 128): string {
  return `/assets/icons/classes/${classId}-crest-${size}.png`;
}

// Character Assets
export function getCharacterSpritePath(denizenType: string, classId: string): string {
  return `/assets/characters/${denizenType}/${denizenType}-${classId}.png`;
}

export function getDenizenPartPath(
  denizenType: string,
  part: 'head' | 'torso' | 'arms' | 'legs',
  variant: string = 'default'
): string {
  return `/assets/characters/${denizenType}/${part}_${variant}.png`;
}

// Master Scenes
export function getMasterScenePath(landId: string, classId: string): string {
  // CRITICAL: Scene files use underscore in land name, dash before class
  // Example: seelie_groves-scryer.png (not seelie-groves-scryer.png)
  const landWithUnderscore = landId.replace(/-/g, '_');
  return `/assets/scenes/${landWithUnderscore}-${classId}.png`;
}

// Props and Equipment
export function getPropPath(
  category: 'demeanor' | 'nature' | 'ambient',
  propId: string
): string {
  return `/assets/icons/props/${category}/${propId}.png`;
}

export function getEquipmentPath(equipmentId: string): string {
  return `/assets/icons/equipment/${equipmentId}.png`;
}

// Status, Tool, Action Icons
export function getStatusIconPath(statusId: string): string {
  // Some status icons are animated GIFs
  const ext = ['thinking', 'researching'].includes(statusId) ? 'gif' : 'png';
  return `/assets/icons/status/${statusId}.${ext}`;
}

export function getToolIconPath(toolId: string): string {
  return `/assets/icons/tools/${toolId}.png`;
}

export function getActionIconPath(actionId: string): string {
  return `/assets/icons/actions/${actionId}.png`;
}

// UI Components
export function getUIComponentPath(
  category: 'chrome' | 'buttons' | 'forms' | 'navigation' | 'chat' | 'panels',
  componentId: string
): string {
  return `/assets/ui/${category}/${componentId}.png`;
}

// Map Assets
export function getMapAssetPath(assetId: string): string {
  return `/assets/map/${assetId}.png`;
}

export function getMapRegionPath(landId: string): string {
  return `/assets/map/regions/${landId}.png`;
}

// Environment Scenes
export function getEnvironmentPath(environmentId: 'summoning-chamber' | 'council-chamber'): string {
  return `/assets/environments/${environmentId}.png`;
}

/**
 * Asset existence validation
 * Use before rendering to provide fallbacks
 */
export async function assetExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Preload critical assets for performance
 * Call during page load for hero assets
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}
```

**Usage Example (Svelte Component)**:

```svelte
<script lang="ts">
  import {
    getMasterScenePath,
    getLandBackdropPath,
    getCharacterSpritePath,
    preloadImage
  } from '$lib/services/scene';
  import { onMount } from 'svelte';

  export let landId: string;
  export let classId: string;
  export let denizenType: string;

  // Use master scene (recommended for MVP)
  const sceneSrc = getMasterScenePath(landId, classId);

  // Alternative: Layer composition
  const backdropSrc = getLandBackdropPath(landId);
  const characterSrc = getCharacterSpritePath(denizenType, classId);

  // Preload critical assets
  onMount(async () => {
    await preloadImage(sceneSrc);
  });
</script>

<!-- Master Scene Approach (Recommended) -->
<div class="scene-container">
  <img src={sceneSrc} alt="{landId} {classId}" class="master-scene" />
</div>

<!-- Alternative: Layered Composition -->
<div class="scene-container layered">
  <img src={backdropSrc} alt="{landId} backdrop" class="layer layer-background" />
  <img src={characterSrc} alt="{denizenType} {classId}" class="layer layer-character" />
</div>

<style>
  .scene-container {
    width: 1920px;
    height: 1080px;
    position: relative;
    overflow: hidden;
  }

  .master-scene,
  .layer {
    /* CRITICAL: Preserve pixel art sharpness */
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
  }

  .master-scene {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .layered .layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .layer-background {
    z-index: 1;
  }

  .layer-character {
    z-index: 5;
  }
</style>
```

### 2.2 Component Integration Patterns

Framework-specific patterns for consuming pixel art assets.

#### React/Next.js

```typescript
// components/MasterScene.tsx
import Image from 'next/image';
import { getMasterScenePath } from '@/lib/scene';

interface MasterSceneProps {
  landId: string;
  classId: string;
}

export function MasterScene({ landId, classId }: MasterSceneProps) {
  const sceneSrc = getMasterScenePath(landId, classId);

  return (
    <div className="scene-container">
      <Image
        src={sceneSrc}
        alt={`${landId} ${classId}`}
        width={1920}
        height={1080}
        priority // Preload hero image
        style={{
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}
```

#### Svelte/SvelteKit

```svelte
<!-- components/MasterScene.svelte -->
<script lang="ts">
  import { getMasterScenePath } from '$lib/services/scene';

  export let landId: string;
  export let classId: string;

  $: sceneSrc = getMasterScenePath(landId, classId);
</script>

<div class="scene-container">
  <img src={sceneSrc} alt="{landId} {classId}" class="master-scene" />
</div>

<style>
  .master-scene {
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
  }
</style>
```

#### Vue/Nuxt

```vue
<!-- components/MasterScene.vue -->
<template>
  <div class="scene-container">
    <img :src="sceneSrc" :alt="`${landId} ${classId}`" class="master-scene" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getMasterScenePath } from '@/lib/scene';

const props = defineProps<{
  landId: string;
  classId: string;
}>();

const sceneSrc = computed(() => getMasterScenePath(props.landId, props.classId));
</script>

<style scoped>
.master-scene {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
</style>
```

### 2.3 CSS Requirements

Critical CSS rules for preserving VGA pixel art quality.

```css
/* Global pixel art preservation */
* {
  /* Prevent browser from smoothing pixel art */
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;

  /* Prevent subpixel rendering */
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
}

/* Scene rendering (layered composition) */
.scene-container {
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
}

.scene-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

/* Layer z-index system (7 layers) */
.layer-background { z-index: 1; }  /* Land backdrop */
.layer-furniture  { z-index: 2; }  /* Class overlay */
.layer-props      { z-index: 3; }  /* Demeanor/nature props */
.layer-equipment  { z-index: 4; }  /* Equipment objects */
.layer-character  { z-index: 5; }  /* Character sprite */
.layer-foreground { z-index: 6; }  /* Atmospheric effects */
.layer-ui         { z-index: 10; } /* UI overlays (not images) */

/* 9-slice border technique (for UI panels) */
.panel-frame {
  border-image-source: url('/assets/ui/panels/card-frame.png');
  border-image-slice: 20 fill; /* 20px from edges, fill center */
  border-image-width: 20px;
  border-image-repeat: stretch;
  border-width: 20px;
}

/* Icon sizing (maintain aspect ratio) */
.icon-64 {
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
}

.icon-128 {
  width: 128px;
  height: 128px;
  image-rendering: pixelated;
}

.icon-48 {
  width: 48px;
  height: 48px;
  image-rendering: pixelated;
}

/* Animated GIFs (status icons) */
.status-icon {
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
}

/* Responsive scaling (maintain pixel grid) */
@media (max-width: 1920px) {
  .scene-container {
    /* Scale down proportionally, preserve pixels */
    transform-origin: top left;
    transform: scale(calc(100vw / 1920));
  }
}

/* Dark mode support (if applicable) */
@media (prefers-color-scheme: dark) {
  /* Pixel art assets are pre-rendered dark, no filter needed */
  /* Avoid CSS filters (brightness, contrast) that destroy pixel clarity */
}
```

### 2.4 Layer Composition System

If using layered composition (alternative to master scenes), document the 7-layer model.

**Layer Model** (from bottom to top, z-index 1-10):

| Layer | Z-Index | Content | Asset Path | Transparency |
|-------|---------|---------|------------|--------------|
| **1. Background** | 1 | Land backdrop | `/assets/lands/{land}/backdrop.png` | Opaque |
| **2. Furniture** | 2 | Class overlay | `/assets/classes/{class}/overlay.png` | Transparent |
| **3. Props** | 3 | Demeanor/nature props | `/assets/icons/props/**/*.png` | Transparent |
| **4. Equipment** | 4 | Equipment objects | `/assets/icons/equipment/*.png` | Transparent |
| **5. Character** | 5 | Character sprite or paper doll | `/assets/characters/**/*.png` | Transparent |
| **6. Foreground** | 6 | Atmospheric effects | Varies | Transparent |
| **7. UI** | 10 | Svelte components | N/A (not images) | Varies |

**Rendering Order** (TypeScript):

```typescript
interface SceneConfig {
  landId: string;
  classId: string;
  denizenType: string;
  classId: string;
  demeanorProps: string[];
  natureProps: string[];
  equipmentIds: string[];
}

function renderLayeredScene(config: SceneConfig) {
  return {
    layers: [
      {
        zIndex: 1,
        src: getLandBackdropPath(config.landId),
        alt: `${config.landId} backdrop`,
      },
      {
        zIndex: 2,
        src: getClassOverlayPath(config.classId),
        alt: `${config.classId} furniture`,
      },
      {
        zIndex: 3,
        src: config.demeanorProps.map(p => getPropPath('demeanor', p)),
        alt: 'Demeanor props',
      },
      {
        zIndex: 4,
        src: config.equipmentIds.map(e => getEquipmentPath(e)),
        alt: 'Equipment',
      },
      {
        zIndex: 5,
        src: getCharacterSpritePath(config.denizenType, config.classId),
        alt: `${config.denizenType} ${config.classId}`,
      },
      // Layer 6 (foreground effects) - optional
      // Layer 7 (UI) - handled by framework components
    ],
  };
}
```

**Master Scene Alternative** (Recommended for MVP):

```typescript
function renderMasterScene(config: SceneConfig) {
  return {
    src: getMasterScenePath(config.landId, config.classId),
    alt: `${config.landId} ${config.classId}`,
    // Single image, no layering complexity
  };
}
```

---

## Phase 3: Known Issues & Gotchas

### 3.1 Naming Convention Inconsistencies

**Issue**: Mixed naming conventions cause path construction failures.

**Manifestation**:
- Both `seelie-groves/` and `seelie_groves/` directories exist (dash vs underscore)
- Scene files use mixed convention: `seelie_groves-scryer.png` (underscore in land, dash before class)
- Class crests use suffix convention: `scryer-crest-128.png` (not `scryer-128.png`)

**Impact**:
- Path helpers may fail if assuming consistent kebab-case
- File-not-found errors during runtime
- Integration tests may pass but production fails

**Fix**:
```typescript
// WRONG (assumes kebab-case everywhere)
function getMasterScenePath(landId: string, classId: string): string {
  return `/assets/scenes/${landId}-${classId}.png`; // FAILS
}

// CORRECT (handles mixed convention)
function getMasterScenePath(landId: string, classId: string): string {
  const landWithUnderscore = landId.replace(/-/g, '_');
  return `/assets/scenes/${landWithUnderscore}-${classId}.png`; // WORKS
}

// Crest paths also need special handling
function getClassCrestPath(classId: string, size: 128 | 48): string {
  return `/assets/icons/classes/${classId}-crest-${size}.png`; // Note: -crest- infix
}
```

**Root Cause**: Directory consolidation incomplete — duplicate underscore directories remain.

**Permanent Fix**: Run directory cleanup (see [Directory Cleanup](../optimization/directory_cleanup.md)).

### 3.2 Missing Assets or Gaps

**Issue**: Some asset categories incomplete or have unexpected structure.

**Examples**:
1. **Paper Doll Parts**: ~100 files exist but compositing logic not implemented
   - Files: `/assets/characters/{denizen}/{part}_*.png`
   - Status: ⏳ Partial infrastructure, unused in MVP

2. **Props/Equipment Not Rendered**: Icons exist but not integrated into scenes
   - Files: `/assets/icons/props/**/*.png` and `/assets/icons/equipment/*.png`
   - Status: ⏳ Deployed but Layer 3-4 show placeholders
   - Decision needed: Inventory UI vs scene decorations

3. **Class Accessories**: Only Scryer accessories deployed (3 items), other 10 classes missing
   - Files: `/assets/classes/scryer/accessories/*.png`
   - Status: ⏳ Incomplete (30 total expected, 3 deployed)
   - Impact: Post-MVP feature

**Validation**:
```bash
# Check for missing canonical assets
python scripts/verify_asset_inventory.py static/assets
```

### 3.3 Rendering Artifacts and Fixes

**Issue**: Browser default rendering destroys pixel art quality.

**Symptom**: Blurry, smoothed, or anti-aliased appearance.

**Cause**: Browser applies bilinear interpolation by default.

**Fix**:
```css
/* Apply globally to all images */
img, canvas, video {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
```

**Issue**: Transparent PNGs show white fringe or halo.

**Symptom**: Character sprites have white edges when composited over dark backgrounds.

**Cause**: Sub-pixel alpha blending or premultiplied alpha.

**Fix**:
```css
/* Disable alpha blending artifacts */
img {
  image-rendering: pixelated;
  -webkit-backface-visibility: hidden;
  -ms-interpolation-mode: nearest-neighbor;
}
```

**Issue**: Scaling artifacts (non-integer scaling).

**Symptom**: Uneven pixel sizes, distorted grid.

**Cause**: Scaling by non-integer factors (e.g., 1.5×, 2.3×).

**Fix**:
```css
/* Only scale by integer multiples */
.scene-container {
  /* Good: 1×, 2×, 3×, 4× */
  transform: scale(2);

  /* Bad: 1.5×, 2.7× (creates uneven pixels) */
  /* transform: scale(1.5); */
}
```

### 3.4 Browser Compatibility Notes

**Safari/WebKit**:
- `image-rendering: pixelated` supported Safari 10+
- Older versions need `-webkit-crisp-edges` fallback

**Firefox**:
- Use `-moz-crisp-edges` for best support
- `image-rendering: pixelated` supported Firefox 93+

**Chrome/Edge**:
- `image-rendering: pixelated` fully supported
- `crisp-edges` works but `pixelated` preferred

**Recommended CSS**:
```css
img {
  image-rendering: -moz-crisp-edges;    /* Firefox fallback */
  image-rendering: -webkit-crisp-edges; /* Safari fallback */
  image-rendering: pixelated;           /* Modern standard */
  image-rendering: crisp-edges;         /* Older browsers */
}
```

---

## Phase 4: Integration Priorities

### 4.1 Critical Path (Blocks MVP Launch)

Must be implemented before product launch.

**Priority 1: Fix Naming Inconsistency**
- Remove 20 duplicate directories (dash vs underscore)
- Standardize on kebab-case for all directories
- Update path helpers to match actual file structure
- **Impact**: 50% of UI integration currently fails due to path mismatches
- **Effort**: 1-2 hours (directory cleanup + path helper updates)

**Priority 2: Integrate Master Scenes**
- Replace layer 1+2 composition with pre-composed master scenes
- Use `getMasterScenePath()` helper for all scene rendering
- **Impact**: Eliminates scaling mismatch issues, uses validated designs
- **Effort**: 2-3 hours (component updates + testing)

**Priority 3: Character Display (Layer 5)**
- Choose full sprite vs paper doll approach
- Implement character rendering in scene
- **Impact**: Characters currently missing from scenes
- **Effort**: 4-6 hours (decision + implementation)

### 4.2 High Priority (Enhances MVP)

Improves user experience but not strictly required for launch.

**Priority 4: UI Component Integration**
- Buttons, forms, panels, navigation already working
- **Status**: ✅ Mostly complete
- **Remaining**: Chat components, status icons
- **Effort**: 2-3 hours

**Priority 5: Status Icons in Activity Feeds**
- Integrate animated GIFs (thinking.gif, researching.gif)
- **Impact**: Visual feedback during AI operations
- **Effort**: 2-3 hours

**Priority 6: Map Asset Integration**
- If navigation feature exists, integrate map base + regions
- **Impact**: Depends on feature roadmap
- **Effort**: 4-6 hours

### 4.3 Low Priority (Post-MVP)

Nice-to-have features that can wait.

**Priority 7: Props Layer (Demeanor/Nature)**
- 95 prop icons exist but not rendered in scenes
- **Decision needed**: Inventory UI vs scene decorations
- **Effort**: 8-12 hours (design + implementation)

**Priority 8: Equipment Layer**
- 10 equipment icons exist but not rendered
- **Decision needed**: Same as props
- **Effort**: 4-6 hours

**Priority 9: Atmospheric Foreground Effects**
- Layer 6 (ember glow, candle flicker, etc.)
- **Impact**: Polish, not core functionality
- **Effort**: 6-8 hours

---

## Phase 5: Optimization Opportunities

### 5.1 File Size Reduction

**Indexed Color Conversion** (20-30% savings):
- **Current state**: 531/541 PNGs use RGB/RGBA
- **Target**: Convert to indexed (P/PA) for VGA compliance
- **Tool**: Aseprite CLI or Pillow
- **Impact**: 200-250KB total reduction across 545 assets
- **Effort**: 2-3 hours (batch script + validation)

**PNG Optimization** (10-15% additional savings):
- **Tool**: OptiPNG or pngquant
- **Command**: `optipng -o7 *.png`
- **Impact**: Lossless compression, no visual quality loss
- **Effort**: 1 hour (automated)

**Duplicate File Removal**:
- **Discovery**: 10 duplicate land backdrop files (~500KB)
- **Impact**: Clean up redundant assets
- **Effort**: 30 minutes (manual review + deletion)

### 5.2 Performance Improvements

**Preload Critical Assets**:
```typescript
// Preload hero image during page load
onMount(async () => {
  const sceneSrc = getMasterScenePath(landId, classId);
  await preloadImage(sceneSrc);
});
```

**Lazy Load Non-Critical**:
```typescript
// Use intersection observer for off-screen images
import { onIntersection } from '$lib/utils/intersection';

onMount(() => {
  const img = document.querySelector('.prop-icon');
  onIntersection(img, () => {
    img.src = getPropPath('demeanor', 'formal-candle');
  });
});
```

**Sprite Sheets** (Post-MVP):
- Combine status icons into single sprite sheet
- Combine tool icons into sprite sheet
- **Impact**: Reduce HTTP requests from ~20 to ~2
- **Effort**: 4-6 hours (sheet generation + CSS)

### 5.3 Directory Cleanup

**Consolidate Duplicate Directories**:
```bash
# Remove underscore duplicates
rm -rf static/assets/lands/seelie_groves/
rm -rf static/assets/lands/freemark_reaches/
# ... (20 total duplicates)

# Keep kebab-case versions
# Verify all assets present in kebab-case dirs first
```

**Reorganize Props**:
```bash
# Current: /props/ and /icons/props/ both exist
# Target: Consolidate to /icons/props/

mv static/assets/props/* static/assets/icons/props/
rmdir static/assets/props
```

**Organize Equipment**:
```bash
# Current: Flat /objects/ directory
# Target: Categorical /icons/equipment/

mv static/assets/objects/* static/assets/icons/equipment/
rmdir static/assets/objects
```

---

## Documentation Templates

### Template 1: DEV_HANDOFF.md (Minimal)

For quick integration context without extensive detail.

```markdown
# Developer Handoff — [Project Name]

## Asset Summary

**Total Assets**: 545 PNG/GIF files
**Location**: `static/assets/`
**Status**: ✅ All MVP assets deployed and validated

[Include Phase 1 inventory table]

## Quick Start

### Path Helpers

```typescript
import { getMasterScenePath, getLandBackdropPath } from '$lib/services/scene';

const sceneSrc = getMasterScenePath('seelie-groves', 'scryer');
```

[Include 3-5 most critical path helpers]

### CSS Requirements

```css
img {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
```

## Known Issues

1. **Naming inconsistency**: Scene files use mixed convention (`seelie_groves-scryer.png`)
2. **Path helper fix**: Convert kebab-case to underscore for land IDs in scene paths

## Integration Priorities

1. Fix naming inconsistency (CRITICAL)
2. Integrate master scenes (HIGH)
3. Character display (HIGH)

See `ASSET_OPTIMIZATION_REPORT.md` for optimization opportunities.
```

### Template 2: INTEGRATION_GUIDE.md (Comprehensive)

For full developer reference with code examples and troubleshooting.

```markdown
# Asset Integration Guide — [Project Name]

## Overview

[Phase 1: Asset Inventory Documentation — complete tables]

## Path Helpers

[Phase 2.1: Complete TypeScript path helper library]

## Component Integration

[Phase 2.2: Framework-specific examples (React, Svelte, Vue)]

## CSS Requirements

[Phase 2.3: Complete CSS rules with layer z-index system]

## Layer Composition System

[Phase 2.4: 7-layer model documentation]

## Known Issues & Gotchas

[Phase 3: All 4 subsections]

## Integration Priorities

[Phase 4: All 3 priority levels]

## Optimization Opportunities

[Phase 5: All 3 subsections]

## Troubleshooting

### Issue: Images appear blurry
**Solution**: Add `image-rendering: pixelated` CSS

### Issue: File not found errors
**Solution**: Check naming convention (dash vs underscore)

[Additional troubleshooting scenarios]
```

### Template 3: ASSET_OPTIMIZATION_REPORT.md (Quality Analysis)

For non-blocking quality issues and optimization opportunities.

```markdown
# Asset Optimization Report — [Project Name]

Generated: [Date]

## Summary

- **Total Assets Analyzed**: 545 PNG/GIF files
- **Critical Issues**: 1 (naming inconsistency)
- **Optimization Opportunities**: 3 (indexed color, PNG compression, duplicates)
- **Estimated Savings**: 200-250KB (20-30% file size reduction)

## Directory Structure Analysis

[Phase 1 audit results]

### Issues Identified

1. **Duplicate Directories**: 20 directories (dash vs underscore naming)
   - **Impact**: Path construction failures, 50% integration failure rate
   - **Fix**: Consolidate to kebab-case (see Directory Cleanup guide)

## Color Mode Validation

[PNG color mode analysis]

### Results

- **Indexed (P/PA)**: 10/541 files (1.8%)
- **RGB/RGBA**: 531/541 files (98.2%)

### Optimization Opportunity

- **Action**: Convert RGB/RGBA → indexed
- **Savings**: 20-30% file size reduction
- **Tool**: Aseprite CLI or Pillow
- **Non-blocking**: Color values are VGA-compliant, storage mode is suboptimal

## VGA Compliance Spot-Checks

[7 representative assets tested]

### Results

- **Passing**: 6/7 assets (85.7%)
- **Minor Issues**: 1 asset (map base: 286 colors vs 256 max)
- **Status**: Non-critical, colors look correct

## Asset Inventory Verification

[Complete vs deployed comparison]

### Status

- **MVP Assets**: 267/267 deployed (100%)
- **Additional Files**: 278 (character parts, variants, test files)
- **Total**: 545 files

## Recommendations

1. **CRITICAL**: Fix naming inconsistency (blocks integration)
2. **High Priority**: Indexed color conversion (20-30% savings)
3. **Medium Priority**: PNG optimization (10-15% additional savings)
4. **Low Priority**: Remove duplicates (~500KB cleanup)

## Next Steps

[Link to INTEGRATION_GUIDE.md and optimization workflows]
```

---

## Workflow Execution Checklist

### Pre-Handoff

- [ ] Post-generation validation complete (all 5 phases)
- [ ] Asset inventory verified (deployed vs spec)
- [ ] Directory structure audited
- [ ] Color mode validation complete
- [ ] VGA compliance spot-checks complete

### Phase 1: Asset Inventory

- [ ] Generate category breakdown table
- [ ] Document directory structure (tree view)
- [ ] Create file format specifications summary

### Phase 2: Integration Context

- [ ] Write path helper examples (TypeScript/JS)
- [ ] Document component integration patterns (framework-specific)
- [ ] Specify CSS requirements (image-rendering, z-index)
- [ ] Document layer composition system (if applicable)

### Phase 3: Known Issues

- [ ] Document naming convention inconsistencies
- [ ] Identify missing assets or gaps
- [ ] List rendering artifacts and fixes
- [ ] Add browser compatibility notes

### Phase 4: Integration Priorities

- [ ] Define critical path (blocks MVP)
- [ ] Define high priority (enhances MVP)
- [ ] Define low priority (post-MVP)

### Phase 5: Optimization Opportunities

- [ ] Specify file size reduction strategies
- [ ] Recommend performance improvements
- [ ] Outline directory cleanup tasks

### Documentation Delivery

- [ ] Create DEV_HANDOFF.md or INTEGRATION_GUIDE.md
- [ ] Create ASSET_OPTIMIZATION_REPORT.md (if quality issues exist)
- [ ] Update project README with asset achievements
- [ ] Link integration guide from main documentation

---

## Success Criteria

✅ **Complete Documentation Delivered**
- All 5 phases documented comprehensively
- Code examples work without modification
- Known issues clearly identified with fixes

✅ **Developer Can Integrate Without Support**
- Path helpers copy-paste ready
- CSS requirements specified
- Integration priorities clear

✅ **Quality Issues Flagged**
- Critical blockers identified (naming inconsistency)
- Non-blocking optimizations documented (indexed color)
- Effort estimates provided

✅ **Optimization Path Clear**
- File size reduction opportunities quantified
- Performance improvements specified
- Directory cleanup steps outlined

---

## Related Workflows

- [Post-Generation Validation](post_generation_validation.md) — Must complete before handoff
- [Asset Inventory](asset_inventory.md) — Generates inventory data for handoff
- [Directory Cleanup](../optimization/directory_cleanup.md) — Fixes naming inconsistencies
- [Indexed Color Conversion](../optimization/indexed_color.md) — File size optimization
- [File Size Optimization](../optimization/file_size.md) — PNG compression

---

## Case Study: Session 13 Developer Handoff

### Context

After completing all MVP asset generation (Sessions 1-12), Session 13 focused on quality validation and developer handoff. 545 PNG/GIF files were deployed across 10 categories.

### Handoff Documents Created

1. **DEV_HANDOFF.md** (minimal template)
   - Asset inventory breakdown (545 files across 10 categories)
   - Path helper examples (TypeScript/SvelteKit)
   - Known issues (naming inconsistency, character layer incomplete)
   - Integration priorities (master scenes as hero feature)

2. **ASSET_OPTIMIZATION_REPORT.md** (quality analysis)
   - Directory structure audit (20 duplicate directories discovered)
   - Color mode validation (531/541 RGB/RGBA → 20-30% optimization opportunity)
   - VGA compliance results (6/7 passing, 1 minor palette violation)
   - Asset inventory verification (545 deployed vs 267 expected)

### Key Discoveries Documented

**Critical Blocker**:
- 20 duplicate directories (dash vs underscore naming) causing 50% integration failure rate
- **Impact**: Path construction fails, master scenes not loading
- **Fix**: Directory consolidation (1-2 hours effort)

**Non-Blocking Optimizations**:
- 98.2% of PNGs using RGB/RGBA instead of indexed (20-30% file size savings available)
- 10 duplicate land backdrop files (~500KB redundant)
- Map base has 286 colors (vs 256 max, but colors look correct)

**Integration Recommendation**:
- Use master scenes (pre-composed 1920×1080) over layer composition
- **Rationale**: Eliminates scaling mismatches, uses user-validated designs
- **Benefit**: Faster render, proven VGA aesthetic, fewer edge cases

### Developer Feedback Integration

**Question**: "Should we use master scenes or layer composition?"

**Answer** (from DEV_HANDOFF.md):
> Master scenes are recommended for MVP. They're pre-validated, have no scaling issues,
> and render faster (1 image vs 2-3 layers). Layer composition offers more flexibility
> but introduces complexity that can wait until post-MVP.

**Question**: "Why are some paths failing?"

**Answer** (from Known Issues section):
> Scene files use mixed convention: `seelie_groves-scryer.png` (underscore in land, dash before class).
> Path helpers must convert kebab-case land IDs to underscore before constructing scene paths.

**Question**: "What CSS is required?"

**Answer** (from CSS Requirements section):
> Critical: `image-rendering: pixelated` on all images. Without this, browsers apply
> bilinear interpolation that destroys pixel art clarity. Also include -moz and -webkit
> prefixes for browser compatibility.

### Outcome

- Developer successfully integrated master scenes within 4 hours
- Naming convention fix unblocked 50% of failed integrations
- Indexed color conversion deferred to post-MVP (non-blocking)
- Total integration time: 2 days (vs estimated 1 week without handoff docs)

---

## Automation Opportunities

### Script: Generate DEV_HANDOFF.md

```python
#!/usr/bin/env python3
"""Generate developer handoff documentation from asset inventory."""

import json
from pathlib import Path
from typing import Dict, List

def generate_handoff_doc(
    inventory: Dict,
    validation_results: Dict,
    output_path: str = "docs/DEV_HANDOFF.md"
):
    """Generate DEV_HANDOFF.md from validation data."""

    sections = []

    # Phase 1: Asset Inventory
    sections.append("# Developer Handoff\n")
    sections.append("## Asset Summary\n")
    sections.append(f"**Total Assets**: {inventory['total']} files\n")
    sections.append("**Location**: `static/assets/`\n\n")

    # Category breakdown table
    sections.append("### Asset Categories\n\n")
    sections.append("| Category | Count | Path |\n")
    sections.append("|----------|-------|------|\n")

    for category, data in inventory['categories'].items():
        sections.append(f"| {category} | {data['count']} | `{data['path']}` |\n")

    # Phase 2: Integration Context
    sections.append("\n## Path Helpers\n\n")
    sections.append("```typescript\n")
    sections.append(generate_path_helpers())
    sections.append("```\n\n")

    # Phase 3: Known Issues
    sections.append("## Known Issues\n\n")

    if validation_results['naming_issues']:
        sections.append("### Naming Convention Inconsistencies\n\n")
        for issue in validation_results['naming_issues']:
            sections.append(f"- {issue}\n")

    # Phase 4: Integration Priorities
    sections.append("\n## Integration Priorities\n\n")
    sections.append("1. **CRITICAL**: Fix naming inconsistency\n")
    sections.append("2. **HIGH**: Integrate master scenes\n")
    sections.append("3. **HIGH**: Character display (Layer 5)\n")

    # Phase 5: Optimization Opportunities
    if validation_results['optimizations']:
        sections.append("\n## Optimization Opportunities\n\n")
        for opt in validation_results['optimizations']:
            sections.append(f"- {opt}\n")

    # Write to file
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(''.join(sections))

    print(f"✅ Generated {output_path}")

def generate_path_helpers() -> str:
    """Generate TypeScript path helper code."""
    return """
export function getMasterScenePath(landId: string, classId: string): string {
  const landWithUnderscore = landId.replace(/-/g, '_');
  return `/assets/scenes/${landWithUnderscore}-${classId}.png`;
}

export function getLandBackdropPath(landId: string): string {
  return `/assets/lands/${landId}/backdrop.png`;
}

export function getCharacterSpritePath(denizenType: string, classId: string): string {
  return `/assets/characters/${denizenType}/${denizenType}-${classId}.png`;
}
"""

if __name__ == '__main__':
    # Load validation results
    with open('validation_results.json') as f:
        results = json.load(f)

    generate_handoff_doc(
        inventory=results['inventory'],
        validation_results=results['validation']
    )
```

### Script: Generate INTEGRATION_GUIDE.md

```python
#!/usr/bin/env python3
"""Generate comprehensive integration guide."""

def generate_integration_guide(output_path: str = "docs/INTEGRATION_GUIDE.md"):
    """Generate complete integration guide with all phases."""

    sections = [
        generate_header(),
        generate_asset_inventory(),
        generate_path_helpers(),
        generate_component_patterns(),
        generate_css_requirements(),
        generate_layer_system(),
        generate_known_issues(),
        generate_priorities(),
        generate_optimizations(),
        generate_troubleshooting(),
    ]

    Path(output_path).write_text('\n\n'.join(sections))
    print(f"✅ Generated {output_path}")

# Implement each section generator...
```

---

## Summary

The Developer Handoff workflow transforms validated assets into production-ready documentation. By documenting inventory, integration context, known issues, priorities, and optimizations, developers can integrate assets efficiently without extensive back-and-forth.

**Key Principles**:
1. **Comprehensive but concise** — All critical information, no unnecessary detail
2. **Code-first** — Working examples, not just descriptions
3. **Issue-aware** — Flag blockers, provide fixes
4. **Priority-driven** — Critical → High → Low
5. **Optimization-conscious** — Non-blocking improvements documented for later

**Deliverables**:
- DEV_HANDOFF.md or INTEGRATION_GUIDE.md
- ASSET_OPTIMIZATION_REPORT.md (if quality issues exist)
- Updated README with asset achievements

**Success Metric**: Developer can integrate without requiring Limner support.

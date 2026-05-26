# Fonts

Bundled fonts for `compose/satori-text` typography rendering.

## IBM Plex Sans Regular

- **Source**: [IBM/plex](https://github.com/IBM/plex/tree/master/packages/plex-sans) — commit time matches the file's `mtime`; refresh by re-downloading from the same path.
- **File**: `IBMPlexSans-Regular.ttf` (~200 KB)
- **License**: SIL Open Font License 1.1 (see `LICENSE.txt`)
- **Why this font**: corporate-neutral, well-supported by Satori's renderer, OSS-compatible for the Apache-2.0 Limner project. Chosen as the default for `compose.renderText` (Phase 3, D-RA-16).

Callers can override the default by passing their own `fonts: [{ name, data, weight, style }]` to `renderText`.

To add additional fonts: drop the TTF here, document it above, ensure the license is compatible with Limner's Apache-2.0 distribution, and reference it explicitly in caller code (or extend the `loadDefaultFont` helper in `src/compose/satori-text.ts` to expose a registry).

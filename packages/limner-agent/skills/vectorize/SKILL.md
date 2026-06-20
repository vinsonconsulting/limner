---
name: vectorize
description: Trace a raster image into a scalable SVG with the limner_vectorize tool, for logos, icons, and flat art that must stay crisp at any size. Load when converting a raster to vector or preparing a logo for scaling.
license: Apache-2.0
---

# Vectorize a raster image

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill to trace a raster image into a scalable SVG, so a logo, icon, or
flat illustration stays crisp at any size and is editable in a vector tool. The
limner_vectorize tool does the trace; it is a paid Recraft call. The reference at
the end states when a vector beats a raster.

## Procedure

1. Check the source suits vectorizing. Flat graphics (logos, icons, line art)
   trace cleanly; photographs and shaded images do not.
2. Vectorize. Call limner_vectorize with the source image URL. It is a paid
   Recraft call that returns an SVG through its capability URL.
3. Refine if needed. Open the SVG in a vector editor (Inkscape, Affinity
   Designer) for path cleanup, or use it directly where scalability matters.
4. Rasterize back if a fixed-size raster is needed. Render the SVG out through
   compose.

## Judgment

- Vectorize flat art, not photos. A traced photograph is a heavy, messy SVG;
  upscale a photo instead.
- When you control the source, generate vector from the start with Recraft
  rather than tracing a raster afterward.
- It is a paid call, so vectorize the final raster, not every draft.

## Reference

The text below is generated from the Limner guidance core (`@limner/core`), the
same source the MCP vectorize prompt serves, so this skill and that prompt cannot
drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: vectorize -->
# Vectorize a raster image

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Vectorizing traces a raster image (a PNG or JPEG) into a scalable SVG made of paths, so a logo, icon, or flat illustration stays crisp at any size and can be edited in a vector tool. Limner does this with the limner_vectorize tool, a paid Recraft call: it takes a source image by URL and returns an SVG.

## When to vectorize

- Vectorize flat graphics: logos, icons, monograms, simple illustrations, and line art. These trace cleanly into a small set of paths.
- Do not vectorize photographs or richly shaded images. Tracing them yields a heavy, messy SVG that is larger and worse than the raster; upscale those instead.
- When you control the source, prefer generating vector from the start with Recraft (the vector_illustration style) rather than tracing a raster afterward. Vectorize is for rasters you already have.

## How it works

- Pass the source image by URL (for example an artifact URL from a prior generation), not inline data. The tool fetches it server-side.
- The result is an SVG delivered through its capability URL, ready to refine in a vector editor or drop into a UI.
- It is a paid Recraft call, so vectorize once you have the raster you want, not on every draft.

## After vectorizing

Hand the SVG off to a vector editor (Inkscape, Affinity Designer) for path cleanup, or use it directly where scalability matters: favicons, app icons, and print. For a raster export at a fixed size, render the SVG back out through compose.

<!-- END GENERATED -->

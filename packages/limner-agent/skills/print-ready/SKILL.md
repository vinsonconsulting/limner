---
name: print-ready
description: Take a Limner asset toward print by upscaling to print resolution, then handing off for CMYK and press formats like TIFF or PDF/X. Load when preparing an asset for professional printing.
license: Apache-2.0
---

# Print-ready export

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill to take a finished asset toward print. Limner generates an RGB
raster and enlarges it to print resolution; the press-specific steps (CMYK color,
bleed, and containers like TIFF or PDF/X) are a handoff to a desktop print tool.
This skill covers the Limner side and where it hands off. The reference at the end
gives the resolution math and the step-by-step ownership.

## Procedure

1. Confirm the printer's requirements: final size, resolution, color profile,
   bleed, and file format. These set everything that follows.
2. Compute the pixel size: print size in inches times 300 dpi (a 5 by 7 inch
   print needs about 1500 by 2100 px).
3. Upscale to that size. Use limner_upscale to enlarge the finished raster toward
   print resolution, while it is still the working asset. For a flat logo,
   vectorize it instead, since a vector stays sharp at any size.
4. Hand off for CMYK and export. Limner stays in RGB and does not write press
   containers, so pass the upscaled asset to a desktop editor (Affinity Photo or
   Publisher, or GIMP) for CMYK conversion, soft-proofing, bleed, and export to
   TIFF or PDF/X.
5. Deliver the working asset. Return the upscaled RGB asset through its capability
   URL so the print tool has a clean, high-resolution source.

## Judgment

- Upscale before color conversion and export, while the asset is still a working
  raster.
- Vectorize flat marks instead of upscaling them; a vector needs no resolution.
- Limner does not do CMYK or PDF/X. Do not promise a press-ready file from Limner
  alone; the CMYK and container steps are the handoff.
- Confirm the printer's color profile and bleed up front. They change the export,
  not the Limner steps.

## Reference

The text below is generated from the Limner guidance core (`@limner/core`), the
same source the MCP print-ready resource serves, so this skill and that resource
cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: print-ready -->
# Print-ready export

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Preparing an asset for print is a finishing and handoff workflow, not a single Limner step. Limner generates an RGB raster and enlarges it toward print resolution; the press-specific steps (CMYK color, bleed, and print containers such as TIFF or PDF/X) happen in a desktop print tool. This reference covers what Limner does and where it hands off.

## Resolution and scale

- Print targets about 300 dpi at final size, so the pixel size you need is the print size in inches times 300. A 5 by 7 inch print needs roughly 1500 by 2100 px.
- The generators top out around 1024 to 1536 px, below most print sizes. Use limner_upscale to enlarge the finished raster toward the pixel size the print needs.
- Upscale while the asset is still the working raster, before color conversion and export. For a flat logo, vectorize it instead, since a vector stays sharp at any size.

## Where each step happens

| Step | Where it happens |
| --- | --- |
| Generate the artwork (RGB raster) | Limner image pipelines |
| Enlarge toward 300 dpi at final size | Limner (limner_upscale) |
| Convert RGB to CMYK | Desktop print tool (Limner stays in RGB) |
| Add bleed, crop marks, and trim | Layout tool |
| Export TIFF or PDF/X | Desktop print tool |

## The handoff

- Limner works in RGB and outputs PNG, JPEG, WebP, and SVG. It does not convert color spaces or write press containers, so the CMYK conversion and the TIFF or PDF/X export are done downstream.
- Hand the upscaled asset to a desktop editor (Affinity Photo or Publisher, or GIMP) for CMYK conversion, soft-proofing, bleed, and the final press export. The external-tools reference lists the handoff targets.

Confirm the printer’s requirements first (size, resolution, color profile, bleed, and file format), since they set the pixel size to upscale to and the container to export. Limner gives the print tool a clean, high-resolution RGB source; the press-ready file comes out of that tool, not Limner alone.

<!-- END GENERATED -->

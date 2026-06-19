---
name: external-tools
description: How to hand a Limner asset off to a desktop editor (GIMP, the Affinity suite, Inkscape, Krita) for manual retouching, vector authoring, print prep, or natural-media painting. Load when a task needs work Limner does not perform itself.
license: Apache-2.0
---

# External editors & handoff

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Limner generates and composes assets, then hands off to a desktop editor when a
task needs manual work it does not perform itself. Use this skill to route a
finished or in-progress asset to the right editor and export it in the format
that editor reads best.

## When to hand off

Hand off once Limner has taken the asset as far as generation and composition
can. Typical triggers:

- Pixel-level retouching, masking, or compositing a generated raster.
- Authoring or cleaning up vector paths beyond what Recraft emits.
- Multi-page or CMYK print layout and prepress.
- Hand-painting or natural-media work on top of a generation.

## Procedure

1. Name the job. Decide which of the needs above the task fits; that points to
   the editor more reliably than preference does.
2. Pick the target from the reference table below: match the job to the editor's
   "Best for" entry, and confirm it reads the format you plan to export.
3. Export from Limner in that editor's preferred input format. Match the
   container to the work: SVG for vector editors, a layered PSD or TIFF for
   raster compositing, PDF for print prep. The file-types skill covers the
   trade-offs.
4. Hand the exported asset to the user with the editor named, so they can open
   and continue it locally. Limner does not drive the desktop editor itself.

## Editor reference

The table below is generated from the Limner guidance core (`@limner/core`), the
same source the MCP `limner://reference/external-tools` resource serves, so this
skill and that resource cannot drift. **Do not edit the generated region by
hand;** run `pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: external-tools -->
# External editors & handoff targets

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Limner produces and composes assets, then hands off to a desktop editor when a task needs manual work it does not perform itself: pixel-level retouching, precise vector authoring, multi-page print layout, or natural-media painting. Pick the target by the job, then export from Limner in the format that editor reads best (see the file-types reference).

| Editor | Kind | Best for | Reads / writes | Cost |
| --- | --- | --- | --- | --- |
| GIMP | Raster | Photo retouching, masking, filters, format conversion | PNG, JPEG, WebP, TIFF, native XCF | Free / open source |
| Affinity Photo | Raster | Professional photo editing and compositing with CMYK + print output | PNG, JPEG, TIFF, PSD, PDF, native .afphoto | Paid (one-time) |
| Affinity Designer | Vector + raster | Brand/logo work, illustration, print-ready vector with CMYK | SVG, PDF, EPS, PSD, native .afdesign | Paid (one-time) |
| Inkscape | Vector | SVG authoring and cleanup, path editing, icons and diagrams | SVG (native), PDF, EPS, PNG export | Free / open source |
| Krita | Raster (paint) | Digital painting and natural-media illustration with brush engines | PNG, JPEG, TIFF, PSD, native .kra | Free / open source |

- Need pixels touched up or a photo composited? Hand off to GIMP (free) or Affinity Photo (print/CMYK).
- Need a logo, icon, or diagram refined as paths? Hand off to Inkscape (free) or Affinity Designer (CMYK print).
- Need hand-painted illustration on top of a generation? Hand off to Krita.
- Match the export format to the target: SVG for vector editors, layered PSD/TIFF for raster compositing, PDF for print prep.

<!-- END GENERATED -->

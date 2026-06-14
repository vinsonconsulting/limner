---
name: file-types
description: Reference for image and document file types (PNG, JPEG, WebP, AVIF, SVG, TIFF, PDF) — compression, alpha, color model, and typical use. Load when choosing or converting an output format.
license: Apache-2.0
---

# File types

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

A quick reference for the image and document formats Limner reads and writes.
Use it when deciding which format to generate or convert to.

The matrix below is generated from the Limner guidance core (`@limner/core`) —
the same source the MCP `limner://reference/file-types` resource serves, so this
skill and that resource cannot drift. **Do not edit the generated region by
hand;** run `pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: file-types -->
# Image & document file types

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Choosing an output format trades fidelity against size, transparency, and downstream tooling. This matrix covers the raster, vector, and document formats Limner handles.

| Format | Compression | Alpha | Color model | Typical use |
| --- | --- | --- | --- | --- |
| PNG | Lossless | Yes | RGB / RGBA | UI assets, screenshots, line art — crisp edges or transparency |
| JPEG | Lossy | No | RGB / CMYK | Photographs where small size beats pixel-exactness |
| WebP | Lossy or lossless | Yes | RGB / RGBA | Web delivery — smaller than PNG/JPEG at similar quality |
| AVIF | Lossy or lossless | Yes | RGB / RGBA | Next-gen web delivery — best compression, newer decoder support |
| SVG | Lossless (vector) | Yes | RGB | Icons, logos, diagrams — resolution-independent markup |
| TIFF | Lossless or lossy | Yes | RGB / CMYK / grayscale | Print and archival masters; high bit-depth, CMYK separations |
| PDF | Mixed (container) | Yes | RGB / CMYK / grayscale | Multi-page, print-ready output: vector + raster + text |

- Lossless (PNG, SVG, TIFF) preserves every pixel or path; lossy (JPEG) discards detail for size.
- Alpha/transparency is available everywhere except baseline JPEG.
- CMYK matters for print (JPEG, TIFF, PDF); the web formats are RGB only.
- Raster DPI is intrinsic to the pixel grid; SVG and PDF scale without DPI loss.

<!-- END GENERATED -->

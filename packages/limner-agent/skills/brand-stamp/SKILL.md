---
name: brand-stamp
description: Stamp a logo or watermark onto a finished image with the compose watermark op, sizing and placing the mark and handling transparency, then deliver one asset. Load when applying brand marks or watermarks.
license: Apache-2.0
---

# Brand stamp and watermark

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill to put a logo or watermark onto a finished image. Compose's
watermark op composites one image onto another at a pixel offset; it has no
opacity, scale, or tiling knob, so you size and fade the mark yourself before
compositing. The reference at the end gives the op's fields and the placement
math.

## Procedure

1. Get the mark ready. Use a logo on a transparent background, or render
   watermark text first with the renderText op onto a transparent canvas.
2. Size the mark. The op places the overlay as-is, so resize it first (the
   compose resize op) to a small fraction of the base; a corner mark is usually
   10 to 20 percent of the width.
3. Compute the position. Position is a pixel offset from the top-left, so derive
   the corner from the sizes: bottom-right is (baseWidth minus overlayWidth minus
   margin, baseHeight minus overlayHeight minus margin).
4. Composite. Call compose with the watermark op (base, overlay, x, y). The
   mark's transparent areas let the base show through.
5. Fade if asked. The op takes no opacity value, so bake reduced opacity into the
   mark before compositing; on Workers you can instead use the Cloudflare Images
   draw layer's opacity.
6. Deliver one asset. Convert to JPEG or WebP if file size matters, then return
   the result through its capability URL.

## Judgment

- Keep the mark small and in a consistent corner across a set so it reads as a
  stamp, not a focal point.
- Prefer a transparent-background logo; a mark with a solid box around it fights
  the image underneath.
- For a faded look, bake the alpha into the mark in local runs; reserve the
  Cloudflare opacity path for Workers, where the Images binding exists.
- The op stamps the mark once. It does not tile a repeated pattern.

## Reference

The table below is generated from the Limner guidance core (`@limner/core`), the
same source the MCP brand-stamp prompt serves, so this skill and that prompt
cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: brand-stamp -->
# Brand stamp and watermark

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

A brand stamp places a logo or a watermark onto a finished image. Limner does this with the compose tool’s watermark op, which composites one image onto another at a pixel offset. The overlay keeps its own transparency, so a mark on a transparent background drops in cleanly. The op has no separate opacity, scale, or tiling control, so you size and fade the mark before compositing it.

## The watermark op

| Field | Meaning |
| --- | --- |
| base | The image to stamp |
| overlay | The mark to place on top; its transparent areas let the base show through |
| x | Horizontal offset from the top-left, in pixels (a negative value bleeds off the left) |
| y | Vertical offset from the top-left, in pixels (a negative value bleeds off the top) |

## Placing the mark

- Position is a pixel offset from the top-left, not a named corner. Compute the corner you want from the sizes: top-left is (margin, margin); bottom-right is (baseWidth minus overlayWidth minus margin, baseHeight minus overlayHeight minus margin).
- Size the mark first. The op places the overlay as-is, so resize the overlay with the compose resize op to the fraction of the base you want (a corner mark is usually 10 to 20 percent of the width).
- Keep the mark on a transparent background so only the logo shows, not a box around it. The op places the mark once; it does not tile a repeated pattern.

## Transparency

- The overlay keeps its own alpha, so a logo exported on a transparent background composites cleanly over the base.
- For a faded watermark, bake the opacity into the mark before compositing (export the logo at reduced opacity), since the watermark op itself takes no opacity value.
- On Workers, the Cloudflare Images path (cfTransform with a draw layer) accepts an opacity from 0 to 1 if you need to fade at compose time. That path needs the Images binding and is not available in local runs.

## Text watermarks

For a text watermark such as a DRAFT banner or a copyright line, render the text first with the renderText op onto a transparent canvas in a server-side font, then composite that result with the watermark op. Set a low-alpha color in the text style for a faded look.

## Delivering

Compose runs locally with no per-call cost and returns PNG by default. Convert the result to JPEG or WebP afterward if file size matters, then deliver it through its capability URL so the stamped image is a single fetchable asset. Keep the mark small and in a consistent corner across a set so it reads as a stamp rather than a focal point.

<!-- END GENERATED -->

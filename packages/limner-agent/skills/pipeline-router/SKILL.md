---
name: pipeline-router
description: Choose the right Limner generation pipeline for an asset, matching output kind, cost, and speed across Midjourney, DALL·E, and Recraft, then finishing with upscale, vectorize, or compose. Load when unsure which pipeline to use.
license: Apache-2.0
---

# Pipeline router

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill to pick the right generation pipeline before you generate, so you
do not pay for a raster you then have to trace or composite text by hand. It
routes by what the asset is first, then by cost and speed. The reference at the
end is the decision table.

## Procedure

1. Name the output kind. Is it vector or raster? Does it need readable text in
   the image? Does it need a transparent background? These decide the pipeline
   before cost does.
2. Match the requirement to a pipeline. Vector and logo work go to Recraft;
   in-image text goes to DALL·E; painterly, art-directed imagery goes to
   Midjourney when the user can run it. Use the reference table for the full
   mapping.
3. Weigh cost and speed to break ties. Midjourney carries no Limner API charge
   but the user runs it and brings the result back; DALL·E and Recraft bill per
   call and return directly. Prefer compose over paying for another generation.
4. Hand off to the chosen pipeline. Load its skill (midjourney, dalle, or
   recraft) and build the prompt there.
5. Plan the finish. If the asset needs print scale, upscale it; if a raster mark
   needs to scale, vectorize it; otherwise convert and resize in compose.

## Judgment

- Decide the output kind before the budget. The wrong format costs more to fix
  later than the right pipeline costs up front.
- Reach for Recraft vector from the start when the asset must scale, rather than
  generating a raster and tracing it afterward.
- Prefer Midjourney when the user has a subscription and wants art direction;
  prefer DALL·E or Recraft when you need the asset returned in one step.
- When two pipelines both fit, choose the one whose native output needs the
  least post-processing.

## Routing reference

The table below is generated from the Limner guidance core (`@limner/core`), the
same source the MCP pipeline-router prompt serves, so this skill and that prompt
cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: pipeline-router -->
# Pipeline router

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Limner exposes three generation pipelines and a set of post-processing tools behind one surface. The right choice depends on what the asset is, what it costs, and how fast you need it. Decide the output kind first (vector or raster, text in the image or not, transparent background or not); cost and speed break the ties.

## Pipelines at a glance

| Pipeline | Best for | Output | Cost and speed |
| --- | --- | --- | --- |
| Midjourney | Stylized, painterly, art-directed imagery; mood and atmosphere | A prompt string you run in your own Midjourney account | No Limner API charge; you generate it in your Midjourney subscription and bring the result back by hand |
| DALL·E (gpt-image-1) | Prompt-faithful images, legible text in the image, transparent-background marks, edits and restyles | Raster (PNG, JPEG, or WebP) up to 1536 px | Billed per call to OpenAI; returned directly |
| Recraft | True vector (SVG) art, logos, icons, and brand-consistent sets | Vector (SVG) or raster up to 1365 px | Billed per call to Recraft; returned directly |

## Choosing by requirement

- A scalable logo, icon, or editable vector: Recraft with the vector_illustration style.
- Readable words inside the image: DALL·E (gpt-image-1), which renders in-image text far better than the others.
- A transparent background: DALL·E or Recraft. Midjourney cannot return one.
- Painterly, art-directed mood when you have a Midjourney subscription to run: Midjourney, which also shifts the cost off the Limner API.
- Editing or restyling an existing image: all three accept an image by URL, so pick by output kind (a DALL·E edit, a Recraft image-to-image, or a Midjourney image prompt with --sref or --oref).

## Finishing the asset

- The generators top out around 1024 to 1536 px, so upscale a finished raster toward 300 dpi when it has to hold up at print scale.
- Vectorize a raster logo or icon into SVG when you need it crisp at any size or editable in a vector tool. When you can, generate vector directly in Recraft from the start instead.
- Compose converts formats, resizes, overlays, and sets text with no per-call cost, so reach for it before paying for another generation.

When two pipelines both fit, prefer the one whose native output needs the least post-processing. A vector asked of Recraft beats a raster you then have to trace, and text rendered by DALL·E beats text you would otherwise composite by hand.

<!-- END GENERATED -->

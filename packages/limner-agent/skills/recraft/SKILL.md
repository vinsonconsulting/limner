---
name: recraft
description: How to drive Limner's Recraft pipeline, choosing style vs. substyle, generating vector (SVG) art from scratch, and transforming a source image. Load when generating with the Recraft pipeline.
license: Apache-2.0
---

# Recraft prompt builder

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Recraft is Limner's brand-and-vector pipeline. Its defining feature is
vector-from-scratch: a vector style yields resolution-independent SVG. This
skill is the procedure for driving it; the recipe at the end lists the styles,
substyles, and other knobs.

## Procedure

1. Pick the style family first, then a substyle that exists within it. When
   unsure, omit the substyle; an unmatched pair is rejected upstream.
2. For scalable brand art (logos, icons), choose the vector style so the output
   is SVG rather than a raster.
3. Put painting media (oil, gouache, watercolor) in the prompt text, not the
   substyle, and pair painterly prompts with the realistic-image style.
4. Describe the subject, then set the size and model for the use.
5. To transform an existing image rather than start fresh, pass it as a source
   image URL and tune strength: low stays close to the source, high follows the
   prompt more.
6. For a consistent set, hold style and substyle fixed and vary only the
   subject. Hand SVG output to a vector editor for cleanup and print prep (see
   the external-tools skill).

## Knob reference

The recipe below is generated from the Limner guidance core (`@limner/core`),
the same source the MCP recraft-builder prompt serves, so this skill and that
prompt cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: recraft-recipe -->
# Recraft prompt recipe

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Recraft is Limner’s brand-and-vector pipeline: it generates raster or true vector (SVG) art and supports fine style control. Its defining feature is vector-from-scratch: pick a vector style and Recraft produces resolution-independent SVG you can refine in a vector editor (see the external-tools reference). Style is the broad family; substyle narrows it.

## Parameters

| Knob | Values | Effect |
| --- | --- | --- |
| style | digital_illustration, vector_illustration, realistic_image | Broad output family; vector_illustration yields SVG |
| substyle | style-specific string (e.g. pixel_art, hand_drawn, line_art) | Optional; narrows the chosen style. Must be a value Recraft defines for that style; an invalid pair returns HTTP 400. Omit when unsure |
| model | recraftv3 (default-era), recraftv2 | Generation model version |
| size | 1024x1024, 1365x1024, 1024x1365 | Output dimensions / orientation |

## Vector from scratch

- Choose style `vector_illustration` to get SVG output rather than a raster, ideal for logos, icons, and scalable brand art.
- Pick `style` first (the family), then a `substyle` that exists within it; an unmatched substyle is rejected upstream (HTTP 400). When unsure, omit `substyle`.
- Painting *media* (oil, gouache, watercolor) go in the **prompt text**, not `substyle`; there is no `oil_painting` substyle. Pair painterly prompts with the `realistic_image` style.
- For brand consistency, keep style/substyle fixed across a set and vary only the prompt subject.
- Hand the SVG off to Inkscape or Affinity Designer for path cleanup and print prep.

## Image to image

Pass a source image by URL to transform it instead of generating from scratch. Recraft restyles the input toward your prompt and chosen style. Use a fetchable URL, not inline data.

| Knob | Values | Effect |
| --- | --- | --- |
| image | URL | Source image to transform; routes to the image-to-image endpoint |
| strength | 0-1 (default 0.5) | How far to move from the source; low stays close, high follows the prompt more |

- Keep style and substyle consistent with the rest of a set so the transformed image matches.
- Raise strength to restyle boldly, lower it to preserve the source composition.

<!-- END GENERATED -->

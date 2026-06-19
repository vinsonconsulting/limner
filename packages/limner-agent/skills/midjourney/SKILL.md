---
name: midjourney
description: How to build a Midjourney prompt with Limner, subject and style first, then parameter flags and optional image references. Load when generating with the Midjourney pipeline.
license: Apache-2.0
---

# Midjourney prompt builder

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Limner's Midjourney pipeline composes a prompt string from a subject, a style
direction, and parameter flags; you or the user paste the result into
Midjourney. This skill is the procedure for assembling a strong prompt. The
recipe at the end lists every knob, its flag, and its range; consult it rather
than recalling values.

## Procedure

1. State the subject concretely. One clear noun phrase beats a vague scene.
2. Add a style and medium direction: art movement, lighting, lens, palette.
3. Set proportions and model with the aspect-ratio and version flags; reach for
   the other flags only when the default grid needs steering.
4. If the user supplied a reference image, decide its role: an image prompt to
   anchor composition, a style reference to borrow a look, or an omni reference
   (version 7) to keep a character consistent. Pass image URLs, not inline data.
5. Exclude unwanted elements with the negative list rather than phrasing them as
   "no X" inside the subject.
6. Iterate: pin a seed once a composition works, then vary one knob at a time.

## Knob reference

The recipe below is generated from the Limner guidance core (`@limner/core`),
the same source the MCP midjourney-builder prompt serves, so this skill and that
prompt cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: midjourney-recipe -->
# Midjourney prompt recipe

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Midjourney rewards a concrete subject plus a style direction, followed by parameter flags. Limner composes the prompt string for you from the subject and the options below; you paste the result into Midjourney. Lead with the subject, add medium and mood, then let the flags tune ratio and variation.

## Structure

- Subject: the concrete thing, stated plainly ("a weathered brass compass on a sea chart").
- Style & medium: art movement, lighting, lens, palette ("cinematic, volumetric light, 35mm").
- Negatives: terms to exclude, emitted as `--no a, b` (merged from the negative prompt and the `no` list).
- Parameters: the flags below, appended automatically in a stable order.

## Parameters

| Knob | Flag | Range / values | Effect |
| --- | --- | --- | --- |
| aspectRatio | --ar | N:N (e.g. 16:9, 1:1, 3:2) | Output proportions |
| version | --v / --niji | v5, v5.1, v5.2, v6, v6.1, v7, niji-5, niji-6 | Model; niji-* routes to the anime-tuned --niji |
| style | --style | raw, cute, expressive, original, scenic (or freeform) | Aesthetic preset; raw reduces Midjourney’s default styling |
| stylize | --stylize | 0-1000 | Strength of Midjourney’s house aesthetic |
| chaos | --chaos | 0-100 | Variation across the initial grid |
| weird | --weird | 0-3000 | Unconventional, experimental aesthetics |
| quality | --q | 0.25, 0.5, 1, 2 | Render effort vs. speed/cost |
| tile | --tile | on/off | Seamless repeating pattern |
| seed | --seed | integer | Reproducibility; reuse a seed to vary one image |

- Start at default stylize and chaos; raise stylize for more polish, chaos for more divergent options.
- Pin a seed once you find a composition you like, then iterate other knobs around it.
- The option-level seed wins over the generic seed when both are set.

## Image reference

Midjourney can take an existing image as part of the prompt. Pass a fetchable URL, not inline data. An image URL leads the prompt as an image prompt, while the reference flags below point at separate URLs for style or character.

| Knob | Flag | Value | Effect |
| --- | --- | --- | --- |
| image | (image prompt) | URL | Composed at the start of the prompt to steer subject and composition |
| imageWeight | --iw | 0-3 (default 1) | How strongly the image prompt counts against the text |
| styleRef | --sref | URL | Style reference: borrow palette, texture, and rendering from another image |
| omniRef | --oref | URL (v7) | Omni reference: carry a character or object across generations (version 7) |

- Lead with an image prompt to anchor composition, then raise or lower --iw to trade the image against the text.
- Use --sref to transfer a look without copying content, and --oref (v7) to keep a recurring character or object consistent.
- There is no --iref flag: style and character references are --sref and --oref.

<!-- END GENERATED -->

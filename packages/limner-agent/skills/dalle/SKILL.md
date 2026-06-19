---
name: dalle
description: How to drive Limner's DALL·E pipeline (gpt-image-1 family), covering a descriptive prompt, size/quality/format/background knobs, reliable text-in-image, and source-image edits. Load when generating with the DALL·E pipeline.
license: Apache-2.0
---

# DALL·E prompt builder

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Limner's DALL·E pipeline calls OpenAI's Images API on the gpt-image-1 family. It
follows detailed instructions well, so the prompt carries most of the weight
while the knobs handle format and background. This skill is the procedure; the
recipe at the end lists the knobs and their values.

## Procedure

1. Write a descriptive prompt: name the subject, composition, lighting, and
   style in plain language. gpt-image-1 rewards specificity.
2. Choose size and quality for the use: square for icons, portrait or landscape
   for scenes; higher quality trades latency and cost for detail.
3. For a logo or UI mark that must drop onto any surface, request a transparent
   background and a format that keeps alpha.
4. To render text in the image, quote the exact words and where they go, keep
   the text short, and verify spelling in the result.
5. To restyle an existing image rather than start over, pass it as a source
   image URL; the edit preserves the subject while applying the prompt.

## Knob reference

The recipe below is generated from the Limner guidance core (`@limner/core`),
the same source the MCP dalle-builder prompt serves, so this skill and that
prompt cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: dalle-recipe -->
# DALL·E prompt recipe

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Limner’s DALL·E pipeline calls OpenAI’s Images API, defaulting to the gpt-image-1 model. Write a descriptive prompt: gpt-image-1 follows detailed instructions closely and renders legible text in the image far better than earlier models. Then set the knobs below. Note that OpenAI’s 2025/2026 consolidation retired DALL·E 2/3 and removed the legacy `style` and `response_format` parameters; Limner does not send them.

## Parameters

| Knob | Values | Applies to | Notes |
| --- | --- | --- | --- |
| model | gpt-image-1 (default), gpt-image-1-mini, gpt-image-1.5, gpt-image-2 | all | gpt-image-1 has the best prompt-following and in-image text |
| size | 1024x1024, 1024x1536, 1536x1024, auto | all | Square, portrait, landscape, or auto |
| quality | low, medium, high, auto | all | Detail vs. cost/latency |
| outputFormat | png, jpeg, webp | all | Defaults to png server-side |
| background | auto, transparent, opaque | all | transparent requires outputFormat png or webp |

## Text in image

- Quote the exact words to render and where they go ("the word OPEN in bold serif, centered").
- Keep rendered text short; long passages still degrade. Verify spelling in the result.
- For logos and UI mockups, pair transparent background with png/webp so the mark drops onto any surface.
- Choose webp or jpeg over png when file size matters and transparency is not needed.

## Image input

Pass a source image by URL to edit or restyle it instead of generating from scratch. Limner routes the request to the image-edit endpoint, which keeps the subject and layout while applying your prompt. Use a fetchable URL, not inline data.

- Provide the image as a URL (for example an artifact URL from a prior generation), then describe the change in the prompt.
- The edit preserves the source likeness and composition; use it to recolor, restyle, or extend an existing image rather than start over.
- The size, quality, output format, and background knobs apply to edits just as they do to fresh generations.

<!-- END GENERATED -->

---
name: illuminated-manuscript
description: Produce an illuminated manuscript page end to end, researching the tradition, generating the miniature, initial, border, and marginalia, composing them, and delivering one page. Load for the full research-to-generation manuscript workflow.
license: Apache-2.0
---

# Illuminated manuscript

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

This is the flagship workflow. It proves the research-to-generation loop rather
than a single generation: you research a tradition, generate each decorative
element, compose them into one page, render the text, and deliver a single
asset. The reference at the end names the elements and which pipeline makes
each.

## Procedure

1. Research first. Use your web tools to pin down the tradition the user wants:
   period, region, script, palette, and the motif vocabulary (borders,
   initials, marginalia). Summarize what you find; it steers every prompt.
2. Generate the miniature. Use the Midjourney or DALL·E skill to produce the
   central illustration in the researched style. This is the anchor image.
3. Generate the initial and decoration. Use the Recraft skill for vector borders
   and the historiated initial; request transparent backgrounds so they
   composite cleanly. To keep a motif consistent across elements, pass an
   earlier generation back in as image input.
4. Compose the page. Use the compose tool to place the miniature, initial, and
   border into one layout, then renderText to set the body in a period-
   appropriate font. Hold the researched palette fixed so the parts read as one
   work.
5. Deliver one page. Return the composed image through its capability URL so the
   user receives a single fetchable asset, not a pile of layers.
6. Hand off if asked. For manual gilding or print prep, point the user to a
   desktop editor through the external-tools skill.

## Judgment

- Stop researching once you can name the script, the palette, and three or four
  signature motifs. More research past that rarely changes the prompts.
- Generate the anchor miniature before the decoration so the border and initial
  can echo its palette.
- Prefer vector output for borders and initials; it scales and composites
  without halos around the edges.

## Element reference

The table below is generated from the Limner guidance core (`@limner/core`), the
same source the MCP illuminated-manuscript prompt serves, so this skill and that
prompt cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: illuminated-manuscript -->
# Illuminated manuscript

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

An illuminated manuscript page pairs lettered text with painted decoration: a central illustration, an ornamented opening initial, a foliate border, and figures in the margins, often heightened with gold. Producing one with Limner is the worked example of the research-to-generation loop, not a single prompt. You research the conventions of a tradition, generate each element, compose them into one page, render the text, and deliver the result as a single asset.

## Visual elements

| Element | What it is | How Limner makes it |
| --- | --- | --- |
| Miniature | The central painted illustration or scene | Midjourney or DALL·E generation |
| Historiated initial | An enlarged opening letter enclosing a figure or scene | Recraft or DALL·E, usually on a transparent background |
| Border | A decorative frame of foliate vines, acanthus, or interlace | Recraft vector art or a generated raster, framed in compose |
| Marginalia | Small figures and drolleries set in the margins | Small generations composited around the text block |
| Text block | The lettered body in a period script | renderText with a server-side font |
| Gilding | Gold-leaf highlights on initials and accents | Prompted into the generation, reinforced in compose |

## The research-to-delivery loop

- Research the tradition first: period, region, script, palette, and motif vocabulary. What you find steers every prompt that follows.
- Generate the elements: the miniature and initial from the image pipelines, the border and marginalia as vector or raster decoration. Reuse a generated element as image input to keep a motif consistent.
- Compose the page: place the miniature, initial, and border, then render the text block over the layout in a chosen font.
- Deliver one page: emit the composed image through its capability URL so the result is a single fetchable asset.

Hold the researched palette and motifs fixed across the elements so the page reads as one work rather than separate generations stacked together.

<!-- END GENERATED -->

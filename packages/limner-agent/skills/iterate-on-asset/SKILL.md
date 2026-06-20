---
name: iterate-on-asset
description: Recall a prior generation and vary, restyle, or post-process it, using the memory and project notes you record as you generate. Load when building on an earlier asset or iterating a series.
license: Apache-2.0
---

# Iterate on a prior asset

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill to build on a generation you made earlier: a variation, a
restyle, or a finished export. Two facts shape the work. Every generation returns
a fetchable capability URL, so a prior asset can feed straight back into a
generator as image input. And Limner does not save generations for you, so recall
depends on notes you record yourself. The reference at the end states the rules.

## Procedure

1. Record as you generate. After each generation worth keeping, save a note with
   limner_record (memory) or limner_record_project_note (a project): the asset
   URL, the prompt, the pipeline, and the key parameters. Nothing is saved
   automatically.
2. Recall the prior asset. Search memory with limner_recall, or read a project
   with limner_get_project_context, then read the URL and parameters back out of
   the note.
3. Decide the move: a variation or restyle, a small same-style change, or a
   finishing step.
4. Vary or restyle. Pass the recalled URL as image input to a generator and
   describe the change, or re-run the same pipeline with the recalled prompt and
   tweaked parameters.
5. Finish if that is the goal. Upscale, vectorize, or compose (crop, caption,
   stamp) the recalled asset instead of regenerating.
6. Close the loop. Record the new asset the same way, noting it derives from the
   prior one.

## Judgment

- Record enough to act cold. A note you cannot iterate from later is not worth
  writing: capture the URL, prompt, pipeline, and parameters.
- Pass the URL as image input when you want to keep the look and change details;
  re-run from the prompt when you want a fresh take in the same style.
- Reuse a Midjourney seed to hold a composition while you vary other knobs.
- Post-process instead of regenerating when the asset is right and only needs
  scale, format, or a finish. It is cheaper and keeps the pixels.

## Reference

The text below is generated from the Limner guidance core (`@limner/core`), the
same source the related MCP surfaces serve, so this skill cannot drift from it.
**Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: iterate-on-asset -->
# Iterate on a prior asset

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Iterating means taking a generation you made earlier and producing the next version: a variation, a restyle, or a finished export. Two facts shape how this works in Limner. First, every generation returns a fetchable capability URL, so a prior asset can feed straight back into a generator as image input. Second, Limner does not save generations automatically, so to recall one later you record it yourself as a note. The discipline of recording is what makes iteration possible.

## Record as you generate

- After a generation worth keeping, write a note with limner_record (a memory entry) or limner_record_project_note (scoped to a project). Put the asset URL, the prompt, the pipeline, and the key parameters in the note so a later recall has everything it needs.
- Use a category on memory entries (for example "generation") so you can filter to them later, and give a project note its projectId so it lands in the right project.
- Nothing is recorded for you. A generation you do not note is not recoverable beyond the current turn.

## Recall the prior asset

- For loose history, search memory with limner_recall by text query, category, or time window. For project work, read limner_get_project_context by project id or name to get the recent notes.
- Read the asset URL and the original prompt and parameters back out of the note. There is no structured generation record, so you parse what you recorded.

## Vary, restyle, or finish

- To vary or restyle, pass the recalled URL as image input to a generator (a DALL·E edit, a Recraft image-to-image, or a Midjourney image prompt) and describe the change. The URL is fetchable on its own, so the generator pulls it directly.
- To make a small change in the same style, re-run the same pipeline with the recalled prompt and parameters, adjusting only what should change. Reusing a Midjourney seed, for example, holds the composition while you vary other knobs.
- To finish rather than change, post-process the recalled asset: upscale it for print, vectorize it to SVG, or compose a crop, caption, or stamp.

## Close the loop

Record the new asset the same way, noting that it derives from the prior one, so the next iteration can recall it in turn. A short, consistent note format (URL, prompt, pipeline, parameters) keeps a project’s history easy to walk.

<!-- END GENERATED -->

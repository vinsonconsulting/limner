---
name: art-research
description: Research an art style, movement, or technique with your web tools and distill the findings into a style profile that steers generation. Load when grounding generation in art history or a specific tradition.
license: Apache-2.0
---

# Art research

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill to turn a question about a style, movement, or technique into
visual direction. Research it with your web tools, distill what defines the look,
and write it to the project's style profile so the research steers every prompt
that follows. This is the research-to-generation loop applied to art history. The
reference at the end states the profile shape and the rules.

## Procedure

1. Research the style. Use your web tools to find its period and origin, palette,
   signature motifs and composition, medium, and a few exemplar works or artists.
   Prefer primary or authoritative sources.
2. Know when to stop. This is a single research pass, not a fleet; stop once you
   can name the palette, the medium, and three or four signature traits.
3. Distill into a profile. Write the findings to the style profile with
   upsertStyleProfile: palette, descriptors, medium. Set provenance.source to
   art-research and note the key sources.
4. Record exemplars. List exemplar works under references (kind url or note).
5. Generate from the research. Shape each prompt from the profile's descriptors
   and medium, and set pipelinePrefs for the pipeline that best renders the style.

## Judgment

- Stop at the point of diminishing returns: palette, medium, and a few signature
  traits are enough to steer prompts.
- Keep descriptors concrete and few; a tight profile generates more consistently
  than a long one.
- Match the pipeline to the medium: vector work to Recraft, painterly work to
  Midjourney or DALL·E.
- The profile is shared, so research done here can seed a brand kit or pair with
  style-from-images.

## Reference

The text below is generated from the Limner guidance core (`@limner/core`), the
same source the related MCP surfaces serve, so this skill cannot drift from it.
**Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: art-research -->
# Art research

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Art research turns a question about a style, movement, or technique into visual direction you can generate from. The agent researches with its own web tools, distills what defines the look, and writes it to a style profile so the research steers every prompt that follows. This is the research-to-generation loop applied to art history rather than a single brief.

## Research the style

- Use your web tools (web search and fetch) to pin down the style: its period and origin, the palette, the signature motifs and composition, the medium and technique, and a few exemplar works or artists.
- This is a single research pass, not a research fleet. Stop once you can name the palette, the medium, and three or four signature traits; more reading rarely changes the prompts.
- Prefer primary or authoritative sources (museum and archive pages) over aggregators, and keep track of where each fact came from.

## Distill into a style profile

- Write the findings to the project’s style profile with upsertStyleProfile: the palette (hex colors), the descriptors (the style keywords the research surfaced), and the medium. Set provenance.source to art-research and note the key sources in provenance.
- List exemplar works under references (kind url or note) so the profile points back at what it is based on.
- Keep the descriptors concrete and few; a tight profile generates more consistently than a long reading list.

## Generate from the research

Shape each prompt from the profile’s descriptors and medium, and set pipelinePrefs for the pipeline that best renders the style (vector work to Recraft, painterly work to Midjourney or DALL·E). The profile is the shared shape the brand-kit and style-from-images surfaces also read, so researched direction flows into a consistent batch.

<!-- END GENERATED -->

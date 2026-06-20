---
name: brand-kit
description: Set a project's brand as a style profile (palette, descriptors, medium, pipeline preferences) and generate a consistent on-brand batch. Load when establishing or applying a brand kit.
license: Apache-2.0
---

# Brand kit

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill to make a series look like one brand. A brand kit in Limner is a
style profile stored on the project: set the palette, descriptors, medium, and
pipeline once, then read it before every generation so the whole batch stays
consistent. The reference at the end states the profile shape and the rules.

## Procedure

1. Set the kit. Write the brand into the project's style profile with
   upsertStyleProfile: palette, descriptors, medium, and pipelinePrefs. Set
   provenance.source to brand-kit and list approved exemplars under references.
2. Read before each generation. Load the profile with readStyleProfile so every
   request starts from the same brand.
3. Shape the prompt from the kit. Build each prompt from the descriptors and
   medium, and apply pipelinePrefs (the preferred pipeline and knob defaults).
4. Hold the look fixed. Keep palette, descriptors, and pipeline settings constant
   across the set and vary only the subject.
5. Finish on brand. Hand off to brand-stamp for a mark on each asset, or to
   multi-size export for a per-platform set.
6. Keep the kit current. Update with the read, merge, write cycle as the brand
   evolves, and note the change in provenance.

## Judgment

- Decide the kit once and reuse it. Re-deciding the look per asset is what breaks
  consistency.
- Keep pipelinePrefs aligned with the per-pipeline recipes, for example a valid
  Recraft style and substyle pair.
- A profile from style-from-images or art-research can seed a kit, since they
  share one shape; merge it in rather than overwrite.

## Reference

The text below is generated from the Limner guidance core (`@limner/core`), the
same source the related MCP surfaces serve, so this skill cannot drift from it.
**Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: brand-kit -->
# Brand kit

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

A brand kit is the set of choices that make a series look like one brand: the palette, the recurring descriptors, the medium, and the pipeline that renders them. In Limner a brand kit is a style profile stored on the project, so you set it once and every later generation reads the same shape. Establish the kit, then generate each asset against it rather than re-deciding the look each time.

## Set the kit

- Write the brand into the project’s style profile with upsertStyleProfile: the palette (brand hex colors, named), the descriptors (the recurring style keywords), and the medium. Set provenance.source to brand-kit.
- Record the preferred pipeline and its knob defaults in pipelinePrefs so the batch renders the same way each time, for example a fixed Recraft style and substyle.
- List approved exemplars under references so the kit points at the assets that define it.

## Generate on brand

- Read the profile with readStyleProfile at the start of each request, then shape the prompt from its descriptors and medium and apply pipelinePrefs.
- Hold the palette, descriptors, and pipeline settings fixed across the set and vary only the subject. Consistency is the point of a kit.
- For a brand mark on each asset, hand off to the brand-stamp workflow; for a per-platform set, hand off to multi-size export.

## Keep the kit current

When the brand evolves, update the profile with the read, merge, write cycle (upsertStyleProfile preserves the rest of the project metadata) and note the change in provenance. A profile authored elsewhere, by an analysis of user images or an art-research pass, can seed the kit, since all of them share one shape; merge it in rather than overwrite.

<!-- END GENERATED -->

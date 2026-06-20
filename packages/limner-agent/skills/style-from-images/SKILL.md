---
name: style-from-images
description: Capture the style of a user's reference images by describing them into a style profile and matching them with native image input, then generate new work in that style. Load when matching a user's own images or moodboard.
license: Apache-2.0
---

# Style from user images

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill when a user brings their own images and wants new work to match.
Limner carries the style across two ways: you describe the references into a
style profile so the look is reusable, and you pass a reference image to a
generator directly so it borrows the look without words. Describe for a
consistent batch; pass the image for a close one-off match. The reference at the
end states the profile shape and the rules.

## Procedure

1. Look at the references. Name the palette (a few hex colors), the descriptors
   (style keywords), and the medium.
2. Write the profile. Use upsertStyleProfile to save them to the project's style
   profile, set provenance.source to style-from-images, and list the user's
   images under references (kind image).
3. Match directly for a close one-off. Pass a reference image URL to a generator
   (a Midjourney style reference with --sref, a DALL·E edit, or a Recraft
   image-to-image).
4. Generate in the style. Shape each prompt from the profile's descriptors and
   medium, and set pipelinePrefs so a batch stays consistent.
5. Hold the look fixed. Keep palette and descriptors constant across the set and
   vary only the subject.

## Judgment

- Capture the few attributes that define the look, not every detail; a tight
  profile generates more consistently than a long one.
- Use native image input for a close single match; use the described profile to
  keep a whole batch consistent.
- Record the user's images under references so the profile's origin is
  traceable.
- The style profile is the shared shape the brand-kit and art-research skills
  also read, so a style captured here flows straight into them.

## Reference

The text below is generated from the Limner guidance core (`@limner/core`), the
same source the MCP style-from-images prompt serves, so this skill and that
prompt cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: style-from-images -->
# Style from user images

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

When a user brings their own images (a moodboard, brand assets, sample work) and wants new work to match, Limner has two ways to carry the style across. You describe the references into a style profile so the look is reusable, and you pass a reference image to a generator directly so it borrows the look without words. Use them together: describe for a consistent batch, pass the image for a close one-off match.

## Describe the references into a profile

- Look at the user’s images and name what defines the style: the palette (a few hex colors), the descriptors (keywords such as flat, cinematic, noir), and the medium (watercolor wash, isometric vector).
- Write them to the project’s style profile with upsertStyleProfile, set provenance.source to style-from-images, and list the user’s images under references (kind image) so the origin is recorded.
- The profile is the shared shape the brand-kit and art-research surfaces also read, so a style captured here flows into later work without re-describing it.

## Match with native image input

- Pass a reference image by URL straight to a generator to borrow its look: a Midjourney style reference (--sref), a DALL·E edit, or a Recraft image-to-image. Use a fetchable URL, not inline data.
- Image input matches a single reference closely; the described profile keeps a whole set consistent. For a batch in the user’s style, set the profile first, then generate each piece.

## Generate in the captured style

- Shape each prompt from the profile’s descriptors and medium, and set pipelinePrefs (the preferred pipeline and its knob defaults) so the batch stays consistent.
- Hold the palette and descriptors fixed across the set and vary only the subject, the same discipline as a brand kit.

Reading the user’s images is a judgment step: capture the few attributes that actually define the look rather than every detail, since a tight profile generates more consistently than a long one.

<!-- END GENERATED -->

---
name: captioned-graphic
description: Put legible text on an image by rendering a caption or headline with the renderText op and compositing it over a base image. Load when adding captions, headlines, titles, or quote cards.
license: Apache-2.0
---

# Captioned graphic

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill to set words on an image: a headline, a caption bar, a title
slide, or a quote card. Compose's renderText op turns a small JSX-shaped layout
into a PNG, and the watermark op composites it over the base image. The text is
exact and legible because you set it, unlike text a generator bakes in. The
reference at the end gives the op details.

## Procedure

1. Write the text. Keep it short: a headline is one line, a caption a brief
   phrase.
2. Choose the layout. Decide where the text sits (a bottom caption band, a
   centered title) and the type style (size, color, weight).
3. Render the text. Use the renderText op with a JSX-shaped layout (flexbox
   style), the canvas size, and the IBM Plex Sans font. Give the canvas a
   transparent background, or a translucent band behind the words for legibility
   over a busy image.
4. Composite over the image. Use the watermark op to place the rendered text
   onto the base image: at (0, 0) if you rendered at full size, or at an offset
   for a strip.
5. Deliver one asset. Convert to JPEG or WebP if file size matters, then return
   the captioned image through its capability URL.

## Judgment

- Render the text at the base image size and composite at (0, 0) for pixel-exact
  placement; render a smaller strip to position a caption like a stamp.
- Put a translucent band behind text over a busy or light image so it stays
  readable.
- Keep one type style across a set so the captions read as a series.
- The built-in font is IBM Plex Sans. Do not assume other families are
  available.

## Reference

The table below is generated from the Limner guidance core (`@limner/core`), the
same source the MCP captioned-graphic prompt serves, so this skill and that
prompt cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: captioned-graphic -->
# Captioned graphic

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

A captioned graphic sets words on an image: a headline, a caption bar, a quote card, or a title slide. Limner renders the text with the compose renderText op, which turns a small JSX-shaped layout into a PNG, then composites it over a base image with the watermark op. Unlike text baked in by a generator, this text is exact and legible because you set it yourself.

## How renderText works

- renderText takes a JSX-shaped object ({ type, props: { style, children } }), a width and height, and a font, and returns a PNG. The style is CSS-like: flexbox layout, fontSize, color, padding, and background.
- It renders a whole canvas. For a caption over a photo, give the canvas a transparent background, or a translucent band behind the words, then composite the result onto the base image.
- Fonts resolve server-side by id. One family is built in, IBM Plex Sans (id ibm-plex-sans), used by default; name it in the font list when you set other text styles.

## Laying out the text

- Place the text with flexbox: justifyContent and alignItems position it (for example flex-end for a caption at the bottom), and padding insets it from the edges.
- Keep the text short and large enough to read at the final size: a headline is one line, a caption a brief phrase.
- Over a busy or light image, put a translucent band behind the words (a child element with an rgba background) so they stay legible.

## Compositing over the image

- Render the text at the base image’s size with a transparent background, then composite it with the watermark op at (0, 0) so it lands exactly where you laid it out.
- Or render a smaller caption strip and composite it at the offset you want, the same way as a brand stamp.
- Hold the type style (font size, color, band) consistent across a set so the captions read as one series.

## Delivering

Compose runs locally with no per-call cost and returns PNG. Convert to JPEG or WebP afterward if file size matters, then deliver the captioned image through its capability URL as a single asset.

<!-- END GENERATED -->

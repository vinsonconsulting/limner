import type { GuidanceEntry } from '../types.js';

/**
 * Concept #7: captioned graphic. The single source shared by the
 * captioned-graphic prompt and skill. Facts mirror the compose stack's
 * renderText op (satori-text.ts) and the watermark composite (photon-ops.ts):
 * renderText turns a JSX-shaped layout into a PNG using a server-side font (one
 * built-in family, IBM Plex Sans), which is then composited over a base image.
 * Verified with a local renderText smoke during authoring.
 */
export const captionedGraphic: GuidanceEntry = {
  id: 'captioned-graphic',
  title: 'Captioned graphic',
  summary:
    'How to put legible text on an image with Limner: rendering a caption or headline with the renderText op, then compositing it over a base image.',
  body: [
    {
      kind: 'paragraph',
      text: 'A captioned graphic sets words on an image: a headline, a caption bar, a quote card, or a title slide. Limner renders the text with the compose renderText op, which turns a small JSX-shaped layout into a PNG, then composites it over a base image with the watermark op. Unlike text baked in by a generator, this text is exact and legible because you set it yourself.',
    },
    { kind: 'heading', level: 2, text: 'How renderText works' },
    {
      kind: 'bullets',
      items: [
        'renderText takes a JSX-shaped object ({ type, props: { style, children } }), a width and height, and a font, and returns a PNG. The style is CSS-like: flexbox layout, fontSize, color, padding, and background.',
        'It renders a whole canvas. For a caption over a photo, give the canvas a transparent background, or a translucent band behind the words, then composite the result onto the base image.',
        'Fonts resolve server-side by id. One family is built in, IBM Plex Sans (id ibm-plex-sans), used by default; name it in the font list when you set other text styles.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Laying out the text' },
    {
      kind: 'bullets',
      items: [
        'Place the text with flexbox: justifyContent and alignItems position it (for example flex-end for a caption at the bottom), and padding insets it from the edges.',
        'Keep the text short and large enough to read at the final size: a headline is one line, a caption a brief phrase.',
        'Over a busy or light image, put a translucent band behind the words (a child element with an rgba background) so they stay legible.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Compositing over the image' },
    {
      kind: 'bullets',
      items: [
        'Render the text at the base image’s size with a transparent background, then composite it with the watermark op at (0, 0) so it lands exactly where you laid it out.',
        'Or render a smaller caption strip and composite it at the offset you want, the same way as a brand stamp.',
        'Hold the type style (font size, color, band) consistent across a set so the captions read as one series.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Delivering' },
    {
      kind: 'paragraph',
      text: 'Compose runs locally with no per-call cost and returns PNG. Convert to JPEG or WebP afterward if file size matters, then deliver the captioned image through its capability URL as a single asset.',
    },
  ],
};

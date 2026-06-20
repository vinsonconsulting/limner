---
name: multi-size-export
description: Export one image at several sizes and formats for web, app, and social destinations using the compose resize and convert ops, then deliver each variant. Load when producing an export set or multiple sizes.
license: Apache-2.0
---

# Multi-size and format export

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

Use this skill to turn one finished image into the set of sizes and formats each
destination needs. Compose's resize and convert ops do the work locally; you
decide the targets and the format per destination. The reference at the end
lists common targets and the fit and format rules.

## Procedure

1. List the targets. Write down each destination with its size and aspect, and
   confirm the current spec for any social platform.
2. Pick the format per target. WebP or AVIF for web and app weight, PNG for
   transparency or interface marks, JPEG for photographs.
3. Resize to each size. Use the compose resize op. It fills the target box and
   crops the overflow, so confirm the source aspect matches the target or expect
   a crop.
4. Letterbox when needed. If a target must keep the whole image, use the
   Cloudflare Images transform with the contain or pad fit, on Workers.
5. Convert and set quality. Use the convert op to reach the target format; lower
   the quality for thumbnails, keep it high for hero images.
6. Deliver the set. Emit each variant through its own capability URL, named by
   destination and size.

## Judgment

- Resize from the largest size first so every smaller variant stays consistent.
- Reach for WebP or AVIF by default on the web; fall back to JPEG or PNG only
  when compatibility or transparency demands it.
- Watch the crop. A square source forced into a wide box loses the top and
  bottom; recrop the subject or letterbox on Workers instead.

## Reference

The table below is generated from the Limner guidance core (`@limner/core`), the
same source the MCP multi-size-export prompt serves, so this skill and that
prompt cannot drift. **Do not edit the generated region by hand;** run
`pnpm --filter @limner/limner-agent gen:skills` instead.

<!-- BEGIN GENERATED: multi-size-export -->
# Multi-size and format export

> Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.

A multi-size export turns one finished image into the set of sizes and formats each destination expects. Limner does this with the compose resize and convert ops, emitting each variant as its own asset. Decide the target sizes and the format for each destination, resize to each, convert, and deliver the set.

## Common targets

| Destination | Typical size and aspect | Format |
| --- | --- | --- |
| Web hero or social card | 1200 x 630 (about 1.91:1) | WebP or JPEG |
| Square social post | 1080 x 1080 (1:1) | JPEG or PNG |
| Story or reel | 1080 x 1920 (9:16) | JPEG |
| App icon | Square, exported at 1x and 2x (for example 512 and 1024) | PNG |
| Favicon or thumbnail | Small square (for example 256 or 64) | PNG or WebP |

Treat these as starting points and confirm the current spec for each platform, since social dimensions change over time.

## Resizing and fit

- Local resize fills the target box and crops the overflow (the cover fit). Confirm the source aspect matches the target, or expect a crop at the edges.
- To keep the whole image without cropping (letterbox or pad), use the Cloudflare Images transform with the contain or pad fit. That path runs on Workers only.
- When the source aspect already matches the target, cover and contain agree, so the local resize is enough.

## Choosing the format

- WebP or AVIF for the smallest web and app payloads.
- PNG when you need transparency or a crisp interface mark.
- JPEG for broad-compatibility photographs.
- Set the quality from 1 to 100 on convert to trade file size against fidelity: lower it for thumbnails, keep it high for hero images.

## Delivering the set

Compose runs locally with no per-call cost. Resize from the largest size first so every smaller variant stays consistent, then emit each variant through its own capability URL named by destination and size, so the set is easy to hand off.

<!-- END GENERATED -->

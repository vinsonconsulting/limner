// The compose tool wraps the @limner/core compose facade (Phase 3,
// D-RA-16) as a single MCP tool with a discriminated-union op input.
// Inputs/outputs are base64-encoded image bytes (MCP wire format).
//
// Single-tool design chosen 2026-05-25 — matches the architecture's
// single-bullet phrasing for the `limner_compose` tool, and keeps the MCP
// registry uncluttered (1 entry vs 17).
//
// cf-images-transform ops require ctx.images (Workers transport only);
// the handler returns isError=true with a clear "unsupported_in_stdio"
// message when invoked under the stdio transport.
//
// Refs: D-RA-16

import { z } from 'zod';
import {
  compose,
  base64ToBytes,
  bytesToBase64,
  DEFAULT_FONT_ID,
  isFontId,
  listFontIds,
  fontDisplayName,
  resolveFontBytes,
  type Format,
  type FitMode,
} from '@limner/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { Tool, ToolContext } from '../server.js';

const formatSchema: z.ZodType<Format> = z.enum(['jpeg', 'png', 'webp', 'avif']);
const fitModeSchema: z.ZodType<FitMode> = z.enum(['cover']);
const cfFitSchema = z.enum(['scale-down', 'contain', 'cover', 'crop', 'pad']);

// ---------------- per-op schemas ----------------

// In-isolate (photon) ops — base64 string in/out.
const photonOps = [
  z.object({
    op: z.literal('resize'),
    input: z.string().describe('base64-encoded image bytes (PNG/JPEG/WebP/AVIF auto-detected).'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fit: fitModeSchema.default('cover'),
  }),
  z.object({
    op: z.literal('crop'),
    input: z.string(),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  z.object({ op: z.literal('brightness'), input: z.string(), delta: z.number() }),
  z.object({ op: z.literal('contrast'), input: z.string(), factor: z.number() }),
  z.object({ op: z.literal('blur'), input: z.string(), radius: z.number() }),
  z.object({ op: z.literal('sharpen'), input: z.string() }),
  z.object({
    op: z.literal('watermark'),
    base: z.string(),
    overlay: z.string(),
    x: z.number().int(),
    y: z.number().int(),
  }),
] as const;

// jSquash codec ops.
const codecOps = [
  z.object({
    op: z.literal('encode'),
    raw: z.object({
      data: z.string().describe('base64 of raw RGBA bytes (width*height*4 length).'),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    format: formatSchema,
    quality: z.number().int().min(1).max(100).optional(),
  }),
  z.object({ op: z.literal('decode'), input: z.string(), format: formatSchema }),
  z.object({
    op: z.literal('convert'),
    input: z.string(),
    from: formatSchema,
    to: formatSchema,
    quality: z.number().int().min(1).max(100).optional(),
  }),
] as const;

// Satori typography op.
const satoriOps = [
  z.object({
    op: z.literal('renderText'),
    jsx: z.unknown().describe('JSX-shaped object literal: { type, props: { style, children } }.'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fonts: z
      .array(
        z.object({
          fontId: z.string().describe('Built-in font id, e.g. "ibm-plex-sans". Resolved to bytes server-side.'),
          name: z.string().optional().describe('fontFamily name to match in the JSX; defaults to the built-in font name.'),
          weight: z.number().int().min(100).max(900).optional(),
          style: z.enum(['normal', 'italic']).optional(),
        }),
      )
      .optional()
      .describe('Built-in fonts resolved server-side by id (no inline base64 — large fonts truncate on the wire). Omit to use the default (ibm-plex-sans).'),
  }),
] as const;

// Cloudflare Images Transformations ops — require ctx.images.
const cfOps = [
  z.object({
    op: z.literal('cfTransform'),
    input: z.string(),
    opts: z.object({
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      fit: cfFitSchema.optional(),
      blur: z.number().min(1).max(250).optional(),
      brightness: z.number().min(0).max(2).optional(),
      contrast: z.number().min(0).max(2).optional(),
      background: z.string().optional(),
    }),
    outputFormat: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/avif']).optional(),
  }),
  z.object({
    op: z.literal('cfOverlay'),
    base: z.string(),
    overlay: z.string(),
    top: z.number().int(),
    left: z.number().int(),
  }),
  z.object({ op: z.literal('cfBlur'), input: z.string(), radius: z.number() }),
  z.object({
    op: z.literal('cfSmartCrop'),
    input: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  z.object({
    op: z.literal('cfBackgroundFill'),
    input: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    background: z.string(),
  }),
] as const;

// Strict per-op schema — used for VALIDATION and handler typing, never for
// advertising. zod serializes a discriminatedUnion to a top-level `anyOf`,
// which the Anthropic tool API rejects (and Managed Agents masks as an opaque
// `model_request_failed_error`). Exported so Path A (@limner/cma-tools) can
// re-validate against the same source of truth. See PR #8.
export const composeInputSchema = z.discriminatedUnion('op', [
  ...photonOps,
  ...codecOps,
  ...satoriOps,
  ...cfOps,
]);

type ComposeInput = z.infer<typeof composeInputSchema>;

// Flat ADVERTISED schema — what `tools/list` exposes to the model. Every field
// is optional except `op`; the handler re-validates strictly against
// `composeInputSchema`. Keeping the advertised `input_schema` free of a
// top-level `oneOf`/`anyOf`/`allOf` is required by the Anthropic tool API,
// while strict per-op validation is preserved at call time. Both Path B
// (toMcpInputSchema) and Path A (the CMA template's zod->JSON conversion)
// advertise this flat shape.
const composeAdvertisedSchema = z.object({
  op: z
    .enum([
      'resize', 'crop', 'brightness', 'contrast', 'blur', 'sharpen', 'watermark',
      'encode', 'decode', 'convert', 'renderText',
      'cfTransform', 'cfOverlay', 'cfBlur', 'cfSmartCrop', 'cfBackgroundFill',
    ])
    .describe('Composition op. The required fields differ per op (see each field).'),
  input: z.string().optional().describe('base64 image bytes. Used by: resize, crop, brightness, contrast, blur, sharpen, decode, convert, cfTransform, cfBlur, cfSmartCrop, cfBackgroundFill.'),
  base: z.string().optional().describe('base64 base image. Used by: watermark, cfOverlay.'),
  overlay: z.string().optional().describe('base64 overlay image. Used by: watermark, cfOverlay.'),
  width: z.number().int().positive().optional().describe('Used by: resize, crop, renderText, cfSmartCrop, cfBackgroundFill.'),
  height: z.number().int().positive().optional().describe('Used by: resize, crop, renderText, cfSmartCrop, cfBackgroundFill.'),
  x: z.number().int().optional().describe('Used by: crop, watermark.'),
  y: z.number().int().optional().describe('Used by: crop, watermark.'),
  top: z.number().int().optional().describe('Used by: cfOverlay.'),
  left: z.number().int().optional().describe('Used by: cfOverlay.'),
  fit: fitModeSchema.optional().describe('resize fit mode: cover (only supported mode).'),
  delta: z.number().optional().describe('brightness delta.'),
  factor: z.number().optional().describe('contrast factor.'),
  radius: z.number().optional().describe('Used by: blur, cfBlur.'),
  format: formatSchema.optional().describe('Used by: encode, decode (jpeg|png|webp|avif).'),
  from: formatSchema.optional().describe('convert source format.'),
  to: formatSchema.optional().describe('convert target format.'),
  quality: z.number().int().min(1).max(100).optional().describe('encode/convert quality, 1-100.'),
  raw: z
    .object({
      data: z.string().describe('base64 of raw RGBA bytes (width*height*4 length).'),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional()
    .describe('encode: raw RGBA source.'),
  jsx: z.unknown().optional().describe('renderText: JSX-shaped object literal { type, props }.'),
  fonts: z
    .array(
      z.object({
        fontId: z.string().describe('Built-in font id, e.g. "ibm-plex-sans".'),
        name: z.string().optional().describe('fontFamily name to match in the JSX.'),
        weight: z.number().int().min(100).max(900).optional(),
        style: z.enum(['normal', 'italic']).optional(),
      }),
    )
    .optional()
    .describe('renderText: built-in fonts by id (optional; defaults to ibm-plex-sans).'),
  opts: z.record(z.unknown()).optional().describe('cfTransform: transform options (width/height/fit/blur/brightness/contrast/background).'),
  outputFormat: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/avif']).optional().describe('cfTransform output format.'),
  background: z.string().optional().describe('cfBackgroundFill background color/spec.'),
}).describe('Single composition tool discriminated by `op`; only the chosen op\'s fields apply (validated strictly server-side).');

type ComposeAdvertisedInput = z.infer<typeof composeAdvertisedSchema>;

function imageResult(bytes: Uint8Array, mimeType = 'image/png', meta: Record<string, unknown> = {}): CallToolResult {
  return {
    content: [{ type: 'image', data: bytesToBase64(bytes), mimeType }],
    structuredContent: { op: meta['op'], mimeType, ...meta },
  };
}

function textResult(text: string, meta: Record<string, unknown> = {}): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent: meta,
  };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// M3: in-isolate ops decode/allocate raw RGBA in the 128 MB V8 isolate; photon
// documents a ~10 MP practical ceiling. Cap the output pixel count so a caller
// can't request a multi-GB allocation (e.g. 100000x100000) and OOM the isolate.
// Oversize work should route through the cf-images (network) ops.
const MAX_COMPOSE_PIXELS = 10_000_000;

function pixelCapError(width: number, height: number, op: string): CallToolResult | null {
  if (width * height > MAX_COMPOSE_PIXELS) {
    return errorResult(
      `compose.${op}: ${width}x${height} exceeds the ${MAX_COMPOSE_PIXELS}-pixel in-isolate limit. Use cfTransform/cfSmartCrop (Cloudflare Images) for larger output.`,
    );
  }
  return null;
}

// ---------------- handler ----------------

async function handle(raw: ComposeAdvertisedInput, ctx: ToolContext): Promise<CallToolResult> {
  // The advertised schema is intentionally loose (no top-level combinator);
  // re-validate against the strict per-op union before dispatch.
  const parsed = composeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResult(
      `compose: invalid arguments for op "${String((raw as { op?: unknown }).op)}": ${JSON.stringify(parsed.error.flatten())}`,
    );
  }
  const input: ComposeInput = parsed.data;
  switch (input.op) {
    case 'resize':
      return pixelCapError(input.width, input.height, 'resize')
        ?? imageResult(compose.resize(base64ToBytes(input.input), input.width, input.height, input.fit), 'image/png', { op: 'resize' });
    case 'crop':
      return pixelCapError(input.width, input.height, 'crop')
        ?? imageResult(compose.crop(base64ToBytes(input.input), input.x, input.y, input.width, input.height), 'image/png', { op: 'crop' });
    case 'brightness':
      return imageResult(compose.brightness(base64ToBytes(input.input), input.delta), 'image/png', { op: 'brightness' });
    case 'contrast':
      return imageResult(compose.contrast(base64ToBytes(input.input), input.factor), 'image/png', { op: 'contrast' });
    case 'blur':
      return imageResult(compose.blur(base64ToBytes(input.input), input.radius), 'image/png', { op: 'blur' });
    case 'sharpen':
      return imageResult(compose.sharpen(base64ToBytes(input.input)), 'image/png', { op: 'sharpen' });
    case 'watermark':
      return imageResult(compose.watermark(base64ToBytes(input.base), base64ToBytes(input.overlay), input.x, input.y), 'image/png', { op: 'watermark' });

    case 'encode': {
      const cap = pixelCapError(input.raw.width, input.raw.height, 'encode');
      if (cap) return cap;
      // The encoder reads width*height*4 bytes from the raw buffer; reject a
      // mismatched length up front so it can't read past the supplied data
      // (corrupt output) or pair a tiny buffer with huge declared dimensions.
      const rawBytes = base64ToBytes(input.raw.data);
      const expected = input.raw.width * input.raw.height * 4;
      if (rawBytes.length !== expected) {
        return errorResult(
          `compose.encode: raw.data is ${rawBytes.length} bytes but ${input.raw.width}x${input.raw.height} RGBA requires ${expected}.`,
        );
      }
      const raw = {
        data: new Uint8ClampedArray(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength),
        width: input.raw.width,
        height: input.raw.height,
      };
      const out = await compose.encode(input.format, raw, input.quality !== undefined ? { quality: input.quality } : undefined);
      return imageResult(out, `image/${input.format}`, { op: 'encode', format: input.format });
    }
    case 'decode': {
      const decoded = await compose.decode(input.format, base64ToBytes(input.input));
      // Decode produces raw RGBA bytes; return as structured text since
      // there's no MCP content block for raw pixel arrays. Caller can
      // round-trip via compose encode.
      return textResult(
        JSON.stringify({
          width: decoded.width,
          height: decoded.height,
          rawBase64: bytesToBase64(new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength)),
        }),
        { op: 'decode', width: decoded.width, height: decoded.height },
      );
    }
    case 'convert': {
      const out = await compose.convert(base64ToBytes(input.input), input.from, input.to, input.quality !== undefined ? { quality: input.quality } : undefined);
      return imageResult(out, `image/${input.to}`, { op: 'convert', from: input.from, to: input.to });
    }

    case 'renderText': {
      const cap = pixelCapError(input.width, input.height, 'renderText');
      if (cap) return cap;
      // Fonts resolve to server-side bytes by id; the tool never transits font
      // bytes inline (a large base64 font truncates on the MCP wire and
      // corrupts the WASM DataView). Omitted fonts -> the default built-in.
      const specs: Array<{
        fontId: string;
        name?: string;
        weight?: number;
        style?: 'normal' | 'italic';
      }> = input.fonts && input.fonts.length > 0 ? input.fonts : [{ fontId: DEFAULT_FONT_ID }];
      const fonts = [];
      for (const f of specs) {
        if (!isFontId(f.fontId)) {
          return {
            content: [{
              type: 'text',
              text: `limner_compose renderText: unknown fontId "${f.fontId}". Available: ${listFontIds().join(', ')}.`,
            }],
            isError: true,
          };
        }
        // Satori's font weight is a literal union (100|...|900); zod emits
        // `number`, so cast at the boundary (out-of-range rejected by zod).
        fonts.push({
          name: f.name ?? fontDisplayName(f.fontId),
          data: resolveFontBytes(f.fontId),
          weight: f.weight as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | undefined,
          style: f.style,
        });
      }
      // ensureResvgInit must be called by the transport entry point before any
      // renderText invocation; we do not load WASM here.
      const out = await compose.renderText(input.jsx, { width: input.width, height: input.height, fonts });
      return imageResult(out, 'image/png', { op: 'renderText' });
    }

    case 'cfTransform':
    case 'cfOverlay':
    case 'cfBlur':
    case 'cfSmartCrop':
    case 'cfBackgroundFill': {
      if (!ctx.images) {
        // r5: a missing IMAGES binding means different things per
        // transport — stdio can never have it (use Workers or an
        // in-isolate op), while a Worker simply hasn't wired it.
        return errorResult(
          ctx.bindings.kind === 'workers'
            ? `compose.${input.op}: images_binding_missing — the IMAGES binding is not configured on this Worker. Enable Cloudflare Images Transformations and add the [images] binding in wrangler.toml, or use an in-isolate equivalent (e.g. compose.blur instead of compose.cfBlur).`
            : `compose.${input.op}: unsupported_in_stdio — Cloudflare Images binding required. Use the Workers HTTP transport, or pick an in-isolate equivalent (e.g. compose.blur instead of compose.cfBlur).`,
        );
      }
      switch (input.op) {
        case 'cfTransform':
          return imageResult(
            await compose.cfTransform(ctx.images, base64ToBytes(input.input), input.opts, input.outputFormat ?? 'image/png'),
            input.outputFormat ?? 'image/png',
            { op: 'cfTransform' },
          );
        case 'cfOverlay':
          return imageResult(
            await compose.cfOverlay(ctx.images, base64ToBytes(input.base), base64ToBytes(input.overlay), input.top, input.left),
            'image/png',
            { op: 'cfOverlay' },
          );
        case 'cfBlur':
          return imageResult(
            await compose.cfBlur(ctx.images, base64ToBytes(input.input), input.radius),
            'image/png',
            { op: 'cfBlur' },
          );
        case 'cfSmartCrop':
          return imageResult(
            await compose.cfSmartCrop(ctx.images, base64ToBytes(input.input), input.width, input.height),
            'image/png',
            { op: 'cfSmartCrop' },
          );
        case 'cfBackgroundFill':
          return imageResult(
            await compose.cfBackgroundFill(ctx.images, base64ToBytes(input.input), input.width, input.height, input.background),
            'image/png',
            { op: 'cfBackgroundFill' },
          );
      }
    }
  }
  // Exhaustiveness guarantee — TS should already mark this unreachable.
  // @ts-expect-error -- unreachable
  return errorResult(`compose: unknown op ${input.op}`);
}

// ---------------- exported tool ----------------

export const composeTool: Tool<ComposeAdvertisedInput> = {
  name: 'limner_compose',
  description:
    'Hybrid V8 composition stack. Wraps photon-ops, jsquash-codecs, satori-text, and cf-images-transform behind a single op-discriminated input. Inputs/outputs are base64-encoded image bytes (PNG default). cf-images ops require the Workers transport (IMAGES binding).',
  inputSchema: composeAdvertisedSchema,
  // Pure image transform: deterministic, no durable mutation, closed-world.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: handle,
};

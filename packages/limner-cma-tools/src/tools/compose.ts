// Compose tool — CMA-side wrapper around the Phase 4 compose tool's
// discriminated-union schema. Each op delegates to @limner/core's
// compose facade. Image-returning ops upload to R2 and return a JSON
// envelope URL; the `decode` op returns structured JSON; `cf*` ops
// pass through `env.IMAGES`.
//
// Refs: D-RA-12, D-RA-16

import type { R2Bucket } from '@cloudflare/workers-types';
import { compose, type CFImagesBinding, type FitMode } from '@limner/core';
import { composeTool as mcpComposeTool, composeInputSchema } from '@limner/mcp';

import { defineTool, type CustomTool } from '../runtime.js';
import { uploadImageToR2, imageReturnEnvelope } from '../r2-upload.js';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

async function emitImage(
  env: Record<string, unknown>,
  bytes: Uint8Array,
  mimeType: string,
  op: string,
  extras: Record<string, unknown> = {},
): Promise<string> {
  const bucket = env['BUCKET'] as R2Bucket;
  const url = await uploadImageToR2(bucket, bytes, mimeType, {
    prefix: `compose-${op}`,
    publicBaseUrl: asString(env['LIMNER_BUCKET_PUBLIC_URL']),
  });
  return imageReturnEnvelope(url, mimeType, { op, ...extras });
}

// The compose tool's input is a discriminated union over 16 ops; the
// zod schema is re-used from @limner/mcp. We type the run handler as
// `unknown` and let the per-op narrowing happen inside (zod has
// already validated the shape; this is just TS variance escape).

export const composeMcpTool: CustomTool = defineTool({
  name: 'limner_compose',
  description:
    'Hybrid V8 composition stack (D-RA-16). Single discriminated-union op input over photon / jsquash / satori / cf-images primitives. Image ops upload to R2 and return a URL envelope.',
  inputSchema: mcpComposeTool.inputSchema as never,
  requires: (env) => Boolean(env['BUCKET']),
  run: async (input, { env }) => {
    // The advertised schema is intentionally loose (no top-level combinator,
    // required by the Anthropic tool API); re-validate against the strict
    // per-op union before dispatch — parity with Path B. See PR #8.
    const v = composeInputSchema.safeParse(input);
    if (!v.success) {
      throw new Error(`compose: invalid arguments: ${JSON.stringify(v.error.flatten())}`);
    }
    const op = (input as { op: string }).op;

    // ---- in-isolate ops (photon + jsquash + satori) ----
    switch (op) {
      case 'resize': {
        const i = input as { input: string; width: number; height: number; fit?: FitMode };
        const bytes = compose.resize(b64decode(i.input), i.width, i.height, i.fit ?? 'cover');
        return emitImage(env, bytes, 'image/png', 'resize');
      }
      case 'crop': {
        const i = input as { input: string; x: number; y: number; width: number; height: number };
        const bytes = compose.crop(b64decode(i.input), i.x, i.y, i.width, i.height);
        return emitImage(env, bytes, 'image/png', 'crop');
      }
      case 'brightness': {
        const i = input as { input: string; delta: number };
        const bytes = compose.brightness(b64decode(i.input), i.delta);
        return emitImage(env, bytes, 'image/png', 'brightness');
      }
      case 'contrast': {
        const i = input as { input: string; factor: number };
        const bytes = compose.contrast(b64decode(i.input), i.factor);
        return emitImage(env, bytes, 'image/png', 'contrast');
      }
      case 'blur': {
        const i = input as { input: string; radius: number };
        const bytes = compose.blur(b64decode(i.input), i.radius);
        return emitImage(env, bytes, 'image/png', 'blur');
      }
      case 'sharpen': {
        const i = input as { input: string };
        const bytes = compose.sharpen(b64decode(i.input));
        return emitImage(env, bytes, 'image/png', 'sharpen');
      }
      case 'watermark': {
        const i = input as { base: string; overlay: string; x: number; y: number };
        const bytes = compose.watermark(b64decode(i.base), b64decode(i.overlay), i.x, i.y);
        return emitImage(env, bytes, 'image/png', 'watermark');
      }

      case 'encode': {
        const i = input as {
          raw: { data: string; width: number; height: number };
          format: 'jpeg' | 'png' | 'webp' | 'avif';
          quality?: number;
        };
        const raw = {
          data: new Uint8ClampedArray(b64decode(i.raw.data).buffer),
          width: i.raw.width,
          height: i.raw.height,
        };
        const bytes = await compose.encode(i.format, raw, i.quality !== undefined ? { quality: i.quality } : undefined);
        return emitImage(env, bytes, `image/${i.format}`, 'encode', { format: i.format });
      }
      case 'decode': {
        // Raw RGBA bytes don't fit an MCP / CMA "image content" shape;
        // return as structured JSON. Callers round-trip via encode.
        const i = input as { input: string; format: 'jpeg' | 'png' | 'webp' | 'avif' };
        const decoded = await compose.decode(i.format, b64decode(i.input));
        return JSON.stringify({
          op: 'decode',
          width: decoded.width,
          height: decoded.height,
          rawBase64: b64encode(
            new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
          ),
        });
      }
      case 'convert': {
        const i = input as {
          input: string;
          from: 'jpeg' | 'png' | 'webp' | 'avif';
          to: 'jpeg' | 'png' | 'webp' | 'avif';
          quality?: number;
        };
        const bytes = await compose.convert(
          b64decode(i.input),
          i.from,
          i.to,
          i.quality !== undefined ? { quality: i.quality } : undefined,
        );
        return emitImage(env, bytes, `image/${i.to}`, 'convert', { from: i.from, to: i.to });
      }

      case 'renderText': {
        const i = input as {
          jsx: unknown;
          width: number;
          height: number;
          fonts: Array<{ name: string; data: string; weight?: number; style?: 'normal' | 'italic' }>;
        };
        const fonts = i.fonts.map((f) => ({
          name: f.name,
          data: b64decode(f.data),
          weight: f.weight as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | undefined,
          style: f.style,
        }));
        const bytes = await compose.renderText(i.jsx, { width: i.width, height: i.height, fonts });
        return emitImage(env, bytes, 'image/png', 'renderText');
      }

      // ---- cf-images ops (require env.IMAGES) ----
      case 'cfTransform':
      case 'cfOverlay':
      case 'cfBlur':
      case 'cfSmartCrop':
      case 'cfBackgroundFill': {
        const images = env['IMAGES'] as CFImagesBinding | undefined;
        if (!images) {
          throw new Error(
            `compose.${op}: requires the IMAGES binding on the consuming Worker (Cloudflare Images Transformations enabled). Use an in-isolate equivalent (compose.blur instead of compose.cfBlur) when IMAGES is unavailable.`,
          );
        }
        let bytes: Uint8Array;
        let mimeType = 'image/png';
        if (op === 'cfTransform') {
          const i = input as unknown as {
            input: string;
            opts: Record<string, unknown>;
            outputFormat?: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif';
          };
          mimeType = i.outputFormat ?? 'image/png';
          bytes = await compose.cfTransform(
            images,
            b64decode(i.input),
            i.opts as never,
            mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif',
          );
        } else if (op === 'cfOverlay') {
          const i = input as unknown as { base: string; overlay: string; top: number; left: number };
          bytes = await compose.cfOverlay(images, b64decode(i.base), b64decode(i.overlay), i.top, i.left);
        } else if (op === 'cfBlur') {
          const i = input as unknown as { input: string; radius: number };
          bytes = await compose.cfBlur(images, b64decode(i.input), i.radius);
        } else if (op === 'cfSmartCrop') {
          const i = input as unknown as { input: string; width: number; height: number };
          bytes = await compose.cfSmartCrop(images, b64decode(i.input), i.width, i.height);
        } else {
          const i = input as unknown as { input: string; width: number; height: number; background: string };
          bytes = await compose.cfBackgroundFill(images, b64decode(i.input), i.width, i.height, i.background);
        }
        return emitImage(env, bytes, mimeType, op);
      }

      default:
        throw new Error(`compose: unknown op ${op}`);
    }
  },
});

export const composeTool = composeMcpTool;

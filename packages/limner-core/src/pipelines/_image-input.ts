// Shared helper for image-to-image / edit pipelines (#15 native image-input).
// Source images arrive by reference (URL), never inline base64: a large image
// arg would truncate on the MCP wire — the same ceiling PR D fixed for outputs.
// The pipeline fetches the URL server-side and hands the bytes to the upstream
// multipart endpoint (OpenAI /v1/images/edits, Recraft /images/imageToImage).
//
// The fetch is SSRF-guarded (see _url-guard.ts): the URL and every redirect
// hop are validated against private/loopback/metadata ranges, and the response
// body is size-capped.

import { PipelineError } from './errors.js';
import { safeFetchImage, type SafeFetchOptions } from './_url-guard.js';

export type FetchedImage = { bytes: Uint8Array; contentType: string };

// 25 MiB — comfortably above any real source image, well under the isolate
// memory ceiling. Caps a malicious/oversized response from exhausting memory.
export const DEFAULT_MAX_INPUT_BYTES = 25 * 1024 * 1024;

export interface FetchInputImageOptions extends SafeFetchOptions {
  /** Max bytes to read from the response body. Default 25 MiB. */
  maxBytes?: number;
}

const IMG_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function fetchInputImage(
  pipelineId: string,
  url: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
  opts: FetchInputImageOptions = {},
): Promise<FetchedImage> {
  const res = await safeFetchImage(pipelineId, url, fetchImpl, opts, signal);
  if (!res.ok) {
    throw new PipelineError(
      pipelineId,
      'invalid_input',
      `input image fetch returned HTTP ${res.status}`,
    );
  }
  const contentType = (res.headers.get('content-type') ?? 'image/png').split(';')[0]!.trim();
  const bytes = await readCappedBody(pipelineId, res, opts.maxBytes ?? DEFAULT_MAX_INPUT_BYTES);
  return { bytes, contentType };
}

// Read the response body, rejecting anything larger than maxBytes. Checks the
// declared Content-Length first (cheap early-out), then enforces the cap while
// streaming so a server that lies about / omits the length can't exceed it.
async function readCappedBody(pipelineId: string, res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = res.headers.get('content-length');
  if (declared && Number(declared) > maxBytes) {
    throw tooLarge(pipelineId, maxBytes);
  }
  const body = res.body;
  if (!body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw tooLarge(pipelineId, maxBytes);
    return buf;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw tooLarge(pipelineId, maxBytes);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function tooLarge(pipelineId: string, maxBytes: number): PipelineError {
  return new PipelineError(
    pipelineId,
    'invalid_input',
    `${pipelineId}: input image exceeds the ${maxBytes}-byte limit`,
  );
}

export function imageFilename(contentType: string): string {
  return `image.${IMG_EXT[contentType] ?? 'png'}`;
}

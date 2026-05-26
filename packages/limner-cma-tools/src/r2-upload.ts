// R2 upload helper for image-returning custom tools. The CMA dispatcher
// expects a `string` return; for image bytes we upload to R2 and return
// a JSON envelope containing the resulting URL. The agent then fetches
// the URL via its built-in web_fetch or sandbox file APIs.
//
// Refs: D-RA-12 (Path A); architecture §3.3 (R2 for image artifacts)

import type { R2Bucket } from '@cloudflare/workers-types';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function extFor(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin';
}

function randomId(): string {
  // crypto.randomUUID is available in Cloudflare Workers and Node 22+.
  // Avoids pulling ulid as a direct cma-tools dep.
  return crypto.randomUUID();
}

export type UploadOptions = {
  /** Prefix under which keys are stored. Default 'limner'. */
  prefix?: string;
  /**
   * If set, return absolute URLs prefixed with this base (e.g.
   * 'https://r2.limner.example/'). When unset, return opaque `r2://`
   * URLs that the consuming Worker resolves to signed URLs or proxies.
   */
  publicBaseUrl?: string;
};

/**
 * Upload image bytes to R2 and return a URL string the CMA agent can
 * fetch. Errors propagate (the dispatcher converts them to tool errors).
 */
export async function uploadImageToR2(
  bucket: R2Bucket,
  bytes: Uint8Array,
  mimeType: string,
  opts: UploadOptions = {},
): Promise<string> {
  const prefix = opts.prefix ?? 'limner';
  const key = `${prefix}/${randomId()}.${extFor(mimeType)}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: mimeType } });
  if (opts.publicBaseUrl) {
    return `${opts.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  return `r2://${key}`;
}

/**
 * Standard JSON envelope returned by image tools. Agents parse to
 * extract the URL; the extra fields (mimeType, dimensions, metadata)
 * help the agent decide downstream tool behavior without an extra
 * fetch.
 */
export function imageReturnEnvelope(
  url: string,
  mimeType: string,
  extras: Record<string, unknown> = {},
): string {
  return JSON.stringify({ url, mimeType, ...extras });
}

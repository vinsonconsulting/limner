// Shared helper for image-to-image / edit pipelines (#15 native image-input).
// Source images arrive by reference (URL), never inline base64: a large image
// arg would truncate on the MCP wire — the same ceiling PR D fixed for outputs.
// The pipeline fetches the URL server-side and hands the bytes to the upstream
// multipart endpoint (OpenAI /v1/images/edits, Recraft /images/imageToImage).

import { PipelineError } from './errors.js';
import { isAbortError } from './_http.js';

export type FetchedImage = { bytes: Uint8Array; contentType: string };

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
): Promise<FetchedImage> {
  let res: Response;
  try {
    res = await fetchImpl(url, signal ? { signal } : {});
  } catch (err) {
    if (isAbortError(err)) {
      throw new PipelineError(pipelineId, 'aborted', 'request aborted', err);
    }
    throw new PipelineError(
      pipelineId,
      'upstream_unavailable',
      `failed to fetch input image: ${stringifyError(err)}`,
      err,
    );
  }
  if (!res.ok) {
    throw new PipelineError(
      pipelineId,
      'invalid_input',
      `input image fetch returned HTTP ${res.status}`,
    );
  }
  const contentType = (res.headers.get('content-type') ?? 'image/png').split(';')[0]!.trim();
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, contentType };
}

export function imageFilename(contentType: string): string {
  return `image.${IMG_EXT[contentType] ?? 'png'}`;
}

function stringifyError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

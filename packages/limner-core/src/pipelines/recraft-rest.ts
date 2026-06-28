// D-RA-25 (amends D-RA-14): Recraft via direct REST to external.api.recraft.ai,
// replacing the composed-MCP adapter. This transport fulfills the same
// RecraftTransport contract the pipeline depends on, so RecraftPipeline is
// unchanged — only the wire protocol differs.
//
// REST surface (OpenAI-compatible):
//   POST https://external.api.recraft.ai/v1/images/generations
//   Authorization: Bearer <RECRAFT_API_KEY>
//   JSON body: { prompt, style, size, n, substyle?, model? }
//   Response:  { data: [{ url? , b64_json? }] }   (default response_format=url)

import { base64ToBytes } from '../base64.js';
import { PipelineError } from './errors.js';
import { asRecord, httpResponseToError, isAbortError } from './_http.js';
import { fetchInputImage, imageFilename } from './_image-input.js';
import type {
  RecraftGenerateArgs,
  RecraftGenerateResult,
  RecraftTransport,
} from './recraft.js';

const BASE_URL = 'https://external.api.recraft.ai/v1';
const GENERATIONS_ENDPOINT = `${BASE_URL}/images/generations`;
const IMAGE_TO_IMAGE_ENDPOINT = `${BASE_URL}/images/imageToImage`;
const CRISP_UPSCALE_ENDPOINT = `${BASE_URL}/images/crispUpscale`;
const VECTORIZE_ENDPOINT = `${BASE_URL}/images/vectorize`;
const DEFAULT_STRENGTH = 0.5;

// D-RA-14 (wave-2): the prompt-less image transforms (upscale, vectorize).
// A source image URL is fetched server-side and posted as multipart `file`,
// the same shape Recraft's processing endpoints share. `responseFormat`
// defaults to Recraft's `url`; tools that re-host to R2 request `b64_json`.
export type RecraftTransformArgs = {
  image: string;
  responseFormat?: 'url' | 'b64_json';
};

export class RestRecraftTransport implements RecraftTransport {
  // The default fetch forwards through an arrow rather than storing the bare
  // global `fetch`: the Cloudflare Workers runtime rejects a detached `fetch`
  // (called as `this.fetchImpl(...)`) with "Illegal invocation". Mirrors the
  // DallePipeline #59 fix; Node tolerates the unbound call, hiding it in tests.
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async generateImage(args: RecraftGenerateArgs): Promise<RecraftGenerateResult> {
    // #15: an `image` URL routes to image-to-image (multipart); otherwise
    // text-to-image generations (JSON).
    const response = args.image
      ? await this.requestImageToImage(args)
      : await this.requestGeneration(args);
    if (!response.ok) {
      throw await httpResponseToError('recraft', response);
    }
    const result = parseRecraftResponse(await response.json());
    // F4 robustness: we asked for inline bytes so the MCP layer can re-host to a
    // signed capability URL. If a style ignored response_format and Recraft
    // returned a hosted url anyway, fetch those bytes through the SSRF guard so
    // the transient CDN url never reaches the client.
    if (args.responseFormat === 'b64_json' && result.url && !result.data) {
      const { bytes, contentType } = await fetchInputImage('recraft', result.url, this.fetchImpl);
      return { data: bytes, mimeType: sniffImageMime(bytes, contentType) };
    }
    return result;
  }

  private async requestGeneration(args: RecraftGenerateArgs): Promise<Response> {
    const body: Record<string, unknown> = {
      prompt: args.prompt,
      style: args.style,
      size: args.size,
      n: 1,
      ...(args.substyle ? { substyle: args.substyle } : {}),
      ...(args.model ? { model: args.model } : {}),
      ...(args.responseFormat ? { response_format: args.responseFormat } : {}),
    };
    try {
      return await this.fetchImpl(GENERATIONS_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw networkError(err);
    }
  }

  // D-RA-14 (wave-2): crisp upscale (sharpen + enlarge toward print scale).
  // Prompt-less transform; routes through the shared multipart helper.
  async upscaleImage(args: RecraftTransformArgs): Promise<RecraftGenerateResult> {
    return this.requestImageTransform(CRISP_UPSCALE_ENDPOINT, args, 'image/png');
  }

  // D-RA-14 (wave-2): vectorize a raster image to SVG. Prompt-less transform;
  // a b64_json response carries the SVG bytes (mime image/svg+xml).
  async vectorizeImage(args: RecraftTransformArgs): Promise<RecraftGenerateResult> {
    return this.requestImageTransform(VECTORIZE_ENDPOINT, args, 'image/svg+xml');
  }

  // Shared path for the prompt-less transforms: fetch the source URL, then
  // POST it as multipart `file`. Do NOT set Content-Type — fetch derives the
  // boundary from the FormData body. `b64MimeType` is the mime to stamp on a
  // b64_json response (png for upscale, image/svg+xml for vectorize).
  private async requestImageTransform(
    endpoint: string,
    args: RecraftTransformArgs,
    b64MimeType: string,
  ): Promise<RecraftGenerateResult> {
    const { bytes, contentType } = await fetchInputImage('recraft', args.image, this.fetchImpl);
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: contentType }), imageFilename(contentType));
    if (args.responseFormat) form.append('response_format', args.responseFormat);
    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch (err) {
      throw networkError(err);
    }
    if (!response.ok) {
      throw await httpResponseToError('recraft', response);
    }
    return parseRecraftImageResponse(await response.json(), b64MimeType);
  }

  // Fetch the source URL, then POST /images/imageToImage (multipart). Do NOT
  // set Content-Type — fetch derives the boundary from the FormData body.
  private async requestImageToImage(args: RecraftGenerateArgs): Promise<Response> {
    const { bytes, contentType } = await fetchInputImage('recraft', args.image!, this.fetchImpl);
    const form = new FormData();
    form.append('prompt', args.prompt);
    form.append('strength', String(args.strength ?? DEFAULT_STRENGTH));
    form.append('style', args.style);
    form.append('n', '1');
    if (args.substyle) form.append('substyle', args.substyle);
    if (args.model) form.append('model', args.model);
    if (args.responseFormat) form.append('response_format', args.responseFormat);
    form.append('image', new Blob([bytes], { type: contentType }), imageFilename(contentType));
    try {
      return await this.fetchImpl(IMAGE_TO_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch (err) {
      throw networkError(err);
    }
  }
}

function networkError(err: unknown): PipelineError {
  if (isAbortError(err)) {
    return new PipelineError('recraft', 'aborted', 'request aborted', err);
  }
  return new PipelineError(
    'recraft',
    'upstream_unavailable',
    `network error: ${stringifyError(err)}`,
    err,
  );
}

// Recraft's generations response mirrors OpenAI's Images API: data[0] carries
// either a hosted `url` (default) or inline `b64_json`. Prefer url so callers
// avoid a base64 round-trip; decode bytes only when that's all we got.
function parseRecraftResponse(json: unknown): RecraftGenerateResult {
  const obj = asRecord(json);
  const data = Array.isArray(obj['data']) ? (obj['data'] as unknown[]) : [];
  const first = asRecord(data[0]);

  const url = first['url'];
  if (typeof url === 'string') {
    return { url };
  }
  const b64 = first['b64_json'];
  if (typeof b64 === 'string') {
    // Sniff the decoded bytes so a vector_illustration style (SVG) is stamped
    // image/svg+xml rather than the raster default — the delivered artifact's
    // extension/content-type must match the actual bytes.
    const data = base64ToBytes(b64);
    return { data, mimeType: sniffImageMime(data, 'image/png') };
  }
  throw new PipelineError(
    'recraft',
    'upstream_error',
    'recraft response missing both url and b64_json',
  );
}

// crispUpscale / vectorize return `{ image: { url? , b64_json? } }`, unlike the
// generations `{ data: [{ ... }] }` shape. Accept either (some processing
// endpoints echo the data[] form); prefer url so callers skip a base64
// round-trip. Recraft does not echo the output mime, and crispUpscale actually
// returns WebP rather than the PNG its caller assumes, so for b64 we sniff the
// decoded bytes' magic and only fall back to the caller-supplied mime for
// formats without a binary signature (e.g. SVG from vectorize).
function parseRecraftImageResponse(json: unknown, b64MimeType: string): RecraftGenerateResult {
  const obj = asRecord(json);
  const image = asRecord(obj['image']);
  const fromData = Array.isArray(obj['data']) ? asRecord((obj['data'] as unknown[])[0]) : {};

  const url = image['url'] ?? fromData['url'];
  if (typeof url === 'string') {
    return { url };
  }
  const b64 = image['b64_json'] ?? fromData['b64_json'];
  if (typeof b64 === 'string') {
    const data = base64ToBytes(b64);
    return { data, mimeType: sniffImageMime(data, b64MimeType) };
  }
  throw new PipelineError(
    'recraft',
    'upstream_error',
    'recraft transform response missing both url and b64_json',
  );
}

// Detect a raster image's mime from its leading magic bytes. Returns `fallback`
// for anything without a recognized binary signature (notably SVG, which is
// text). Keeps the delivered artifact's mime/extension honest regardless of what
// the caller assumed the endpoint returns.
function sniffImageMime(bytes: Uint8Array, fallback: string): string {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'image/webp';
  }
  // SVG is text, not a magic-numbered binary: detect the leading `<?xml`/`<svg`
  // (allowing whitespace/BOM) so vector output is stamped image/svg+xml.
  if (looksLikeSvg(bytes)) {
    return 'image/svg+xml';
  }
  return fallback;
}

// True when the leading bytes look like an SVG document. Decodes only a short
// prefix as UTF-8 (TextDecoder strips a leading BOM), trims whitespace, and
// checks for an XML declaration or an <svg root tag.
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart().toLowerCase();
  return head.startsWith('<?xml') || head.startsWith('<svg');
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

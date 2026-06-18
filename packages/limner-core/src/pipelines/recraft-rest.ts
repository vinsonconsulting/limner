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
const DEFAULT_STRENGTH = 0.5;

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
    return parseRecraftResponse(await response.json());
  }

  private async requestGeneration(args: RecraftGenerateArgs): Promise<Response> {
    const body: Record<string, unknown> = {
      prompt: args.prompt,
      style: args.style,
      size: args.size,
      n: 1,
      ...(args.substyle ? { substyle: args.substyle } : {}),
      ...(args.model ? { model: args.model } : {}),
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
    return { data: base64ToBytes(b64), mimeType: 'image/png' };
  }
  throw new PipelineError(
    'recraft',
    'upstream_error',
    'recraft response missing both url and b64_json',
  );
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

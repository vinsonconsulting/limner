import { assertSecrets, PipelineError } from './errors.js';
import { base64ToBytes } from '../base64.js';
import {
  asRecord,
  httpResponseToError,
  isAbortError,
  parseSize,
} from './_http.js';
import type {
  PipelineContext,
  PipelineGenerateInput,
  PipelineGenerateOutput,
  PipelineRunner,
} from './types.js';

export type DalleOptions = {
  // 'gpt-image-1' (default, recommended by OpenAI), 'dall-e-3', 'dall-e-2',
  // or a future model id. Kept open so new model releases don't require an
  // @limner/core update.
  model?: 'gpt-image-1' | 'dall-e-3' | 'dall-e-2' | (string & {});
  // gpt-image-1: 1024x1024 | 1024x1536 | 1536x1024 | auto
  // dall-e-3:    1024x1024 | 1792x1024 | 1024x1792
  // dall-e-2:    256x256 | 512x512 | 1024x1024
  size?: string;
  // gpt-image-1: 'low' | 'medium' | 'high' | 'auto'  (sent when model is gpt-image-1)
  // dall-e-3 / dall-e-2: not sent — OpenAI's 2025/2026 consolidation removed
  // legacy quality values; sending them now returns HTTP 400.
  quality?: 'low' | 'medium' | 'high' | 'auto' | 'standard' | 'hd' | (string & {});
  // gpt-image-1 only. Defaults server-side to 'png' if omitted.
  outputFormat?: 'png' | 'jpeg' | 'webp';
  // gpt-image-1 only. 'transparent' requires output_format 'png' or 'webp'.
  background?: 'auto' | 'transparent' | 'opaque';
  // dall-e-3-era field; accepted for forward compatibility but no longer
  // sent. OpenAI removed `style` (and `response_format`) from the Images
  // API in the 2025/2026 consolidation.
  style?: 'vivid' | 'natural';
  // Deprecated; ignored. Pipeline auto-detects url vs b64_json in the
  // response since gpt-image-1 and dall-e-3 differ on default shape.
  responseFormat?: 'url' | 'b64_json';
};

const ENDPOINT = 'https://api.openai.com/v1/images/generations';
const DEFAULT_SIZE = '1024x1024';

export class DallePipeline implements PipelineRunner {
  readonly id = 'dalle';
  readonly displayName = 'DALL-E';
  readonly kind = 'api' as const;
  readonly requiredSecrets: readonly string[] = ['OPENAI_API_KEY'];

  // Allow tests to inject a custom fetch without monkey-patching global.
  // The default forwards through an arrow rather than storing the bare global
  // `fetch`: the Cloudflare Workers runtime rejects a detached `fetch` (called
  // as `this.fetchImpl(...)`) with "Illegal invocation", so the global must be
  // invoked with its own receiver. Node tolerates the unbound call, which hid
  // this until the live dogfood — see the receiver-binding regression test.
  constructor(private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {}

  async generate(
    input: PipelineGenerateInput,
    ctx: PipelineContext,
  ): Promise<PipelineGenerateOutput> {
    assertSecrets(this.id, this.requiredSecrets, ctx.secrets);

    const prompt = input.prompt.trim();
    if (prompt.length === 0) {
      throw new PipelineError(this.id, 'invalid_input', 'prompt is required and must be non-empty');
    }

    const opts = (input.options ?? {}) as DalleOptions;
    const model = opts.model ?? 'gpt-image-1';
    const size = opts.size ?? DEFAULT_SIZE;

    // Build only the parameters the target model accepts. OpenAI's 2025/2026
    // consolidation removed `response_format`, `style`, and dall-e-3's
    // `quality` values from the Images API surface; sending any of them
    // returns HTTP 400 "Unknown parameter."
    const body: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
      size,
    };
    if (model === 'gpt-image-1') {
      if (opts.quality) body.quality = opts.quality;
      if (opts.outputFormat) body.output_format = opts.outputFormat;
      if (opts.background) body.background = opts.background;
    }
    // dall-e-3 / dall-e-2: model+prompt+n+size only. Legacy `quality`,
    // `style`, and `response_format` are silently dropped.

    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.secrets['OPENAI_API_KEY']}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ctx.abortSignal,
      });
    } catch (err) {
      if (isAbortError(err)) {
        throw new PipelineError(this.id, 'aborted', 'request aborted', err);
      }
      throw new PipelineError(this.id, 'upstream_unavailable', `network error: ${stringifyError(err)}`, err);
    }

    if (!response.ok) {
      throw await httpResponseToError(this.id, response);
    }

    const json = asRecord(await response.json());
    const data = Array.isArray(json['data']) ? (json['data'] as unknown[]) : [];
    const first = asRecord(data[0]);
    const revisedPrompt = typeof first['revised_prompt'] === 'string'
      ? (first['revised_prompt'] as string)
      : undefined;

    const [w, h] = parseSize(size);
    const metadata: Record<string, unknown> = { pipeline: this.id, model };
    if (revisedPrompt) metadata['revisedPrompt'] = revisedPrompt;

    // Resolve mime type from the gpt-image-1 outputFormat when present;
    // otherwise PNG (the format both dall-e-3 and gpt-image-1 default to).
    const mimeType = resolveMimeType(model, opts.outputFormat);

    // Auto-detect response shape. dall-e-3 returns url by default;
    // gpt-image-1 returns b64_json. Handle whichever is present.
    const url = first['url'];
    if (typeof url === 'string') {
      return { kind: 'image', url, mimeType, width: w, height: h, metadata };
    }

    const b64 = first['b64_json'];
    if (typeof b64 !== 'string') {
      throw new PipelineError(
        this.id,
        'upstream_error',
        'response missing both url and b64_json',
      );
    }
    return {
      kind: 'image',
      data: base64ToBytes(b64),
      mimeType,
      width: w,
      height: h,
      metadata,
    };
  }
}

function resolveMimeType(model: string, outputFormat: string | undefined): string {
  if (model === 'gpt-image-1') {
    switch (outputFormat) {
      case 'jpeg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      case 'png':
      default:
        return 'image/png';
    }
  }
  // dall-e-3 / dall-e-2 are PNG-only.
  return 'image/png';
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

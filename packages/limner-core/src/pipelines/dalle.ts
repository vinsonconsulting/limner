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
  // OpenAI gpt-image model id. Defaults to 'gpt-image-1'. Kept open with
  // (string & {}) so a new gpt-image release doesn't require an @limner/core
  // update. DALL·E 2/3 were retired from the Images API in OpenAI's 2025/2026
  // consolidation and are no longer offered on the account.
  model?: 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2' | (string & {});
  // gpt-image sizes: 1024x1024 | 1024x1536 | 1536x1024 | auto
  size?: string;
  // gpt-image quality: 'low' | 'medium' | 'high' | 'auto' (sent only when set).
  quality?: 'low' | 'medium' | 'high' | 'auto' | (string & {});
  // gpt-image only. Defaults server-side to 'png' if omitted.
  outputFormat?: 'png' | 'jpeg' | 'webp';
  // gpt-image only. 'transparent' requires output_format 'png' or 'webp'.
  background?: 'auto' | 'transparent' | 'opaque';
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

    // OpenAI's 2025/2026 consolidation removed `response_format` and `style`
    // from the Images API surface; the pipeline never sends them. quality /
    // output_format / background apply across the gpt-image family and are
    // sent only when the caller sets them.
    const body: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
      size,
    };
    if (isGptImageModel(model)) {
      if (opts.quality) body.quality = opts.quality;
      if (opts.outputFormat) body.output_format = opts.outputFormat;
      if (opts.background) body.background = opts.background;
    }

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

    // Resolve mime type from the gpt-image outputFormat when present;
    // otherwise PNG (the gpt-image default).
    const mimeType = resolveMimeType(model, opts.outputFormat);

    // Auto-detect response shape: a hosted url or inline b64_json,
    // whichever the API returns. Handle whichever is present.
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

function isGptImageModel(model: string): boolean {
  return model.startsWith('gpt-image');
}

function resolveMimeType(model: string, outputFormat: string | undefined): string {
  if (isGptImageModel(model)) {
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
  // Non-gpt-image models default to PNG.
  return 'image/png';
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

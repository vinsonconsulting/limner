import { assertSecrets, PipelineError } from './errors.js';
import {
  asRecord,
  base64ToBytes,
  httpResponseToError,
  isAbortError,
} from './_http.js';
import type {
  PipelineContext,
  PipelineGenerateInput,
  PipelineGenerateOutput,
  PipelineRunner,
} from './types.js';

export type DalleOptions = {
  // 'dall-e-3' (default), 'dall-e-2', 'gpt-image-1', or a future model id.
  // Kept open so new model releases don't require an @limner/core update.
  model?: 'dall-e-3' | 'dall-e-2' | 'gpt-image-1' | (string & {});
  // dall-e-3: 1024x1024 | 1792x1024 | 1024x1792
  // dall-e-2: 256x256 | 512x512 | 1024x1024
  // gpt-image-1: 1024x1024 | 1024x1536 | 1536x1024 | auto
  size?: string;
  // dall-e-3 only
  quality?: 'standard' | 'hd';
  // dall-e-3 only
  style?: 'vivid' | 'natural';
  // NOTE: response_format was removed from OpenAI's Images API in the
  // 2025/2026 consolidation. The pipeline now auto-detects whether the
  // upstream returned a url (dall-e-3 default) or b64_json (gpt-image-1
  // default) and maps to PipelineImageOutput.url / .data accordingly.
  // This field is accepted for forward compatibility but no longer sent.
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
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

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
    const model = opts.model ?? 'dall-e-3';
    const size = opts.size ?? DEFAULT_SIZE;

    // response_format was deprecated in OpenAI's 2025/2026 Images API
    // consolidation. Do NOT send it; the response shape (url vs b64_json)
    // depends on the model and is auto-detected below.
    const body: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
      size,
    };
    // quality/style apply only to dall-e-3
    if (model === 'dall-e-3') {
      body.quality = opts.quality ?? 'standard';
      body.style = opts.style ?? 'vivid';
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

    // Auto-detect response shape. dall-e-3 returns url by default;
    // gpt-image-1 returns b64_json. Handle whichever is present.
    const url = first['url'];
    if (typeof url === 'string') {
      return { kind: 'image', url, mimeType: 'image/png', width: w, height: h, metadata };
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
      mimeType: 'image/png',
      width: w,
      height: h,
      metadata,
    };
  }
}

function parseSize(size: string): [number | undefined, number | undefined] {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return [undefined, undefined];
  return [Number(match[1]), Number(match[2])];
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

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

// Wraps RetroDiffusion's REST inference endpoint. Specializes in low-res
// pixel-art generation. Returns base64-encoded PNGs.
//
// NOTE: Endpoint and field names mirror RetroDiffusion's public API as of
// Phase 2 v1; adjust when integration tests run against the live service
// if the API has shifted.
export type RetroDiffusionOptions = {
  // RetroDiffusion's prompt style preset, e.g. 'rd_fast__default',
  // 'rd_fast__retro', 'rd_plus__game_asset'. Defaults to rd_fast__default.
  promptStyle?: string;
  // Number of images to generate in one call. Defaults to 1.
  numImages?: number;
};

const ENDPOINT = 'https://api.retrodiffusion.ai/v1/inferences';
const DEFAULT_SIZE = 256;
const DEFAULT_STYLE = 'rd_fast__default';

export class RetroDiffusionPipeline implements PipelineRunner {
  readonly id = 'retrodiffusion';
  readonly displayName = 'RetroDiffusion';
  readonly kind = 'api' as const;
  readonly requiredSecrets: readonly string[] = ['RETRODIFFUSION_API_KEY'];

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

    const opts = (input.options ?? {}) as RetroDiffusionOptions;
    const width = input.width ?? DEFAULT_SIZE;
    const height = input.height ?? DEFAULT_SIZE;
    const promptStyle = opts.promptStyle ?? DEFAULT_STYLE;
    const numImages = opts.numImages ?? 1;

    const body: Record<string, unknown> = {
      prompt,
      width,
      height,
      prompt_style: promptStyle,
      num_images: numImages,
    };
    if (input.seed !== undefined) body.seed = input.seed;

    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          'X-RD-Token': ctx.secrets['RETRODIFFUSION_API_KEY']!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ctx.abortSignal,
      });
    } catch (err) {
      if (isAbortError(err)) {
        throw new PipelineError(this.id, 'aborted', 'request aborted', err);
      }
      throw new PipelineError(
        this.id,
        'upstream_unavailable',
        `network error: ${stringifyError(err)}`,
        err,
      );
    }

    if (!response.ok) {
      throw await httpResponseToError(this.id, response);
    }

    const json = asRecord(await response.json());
    const images = Array.isArray(json['base64_images']) ? (json['base64_images'] as unknown[]) : [];
    const first = images[0];
    if (typeof first !== 'string') {
      throw new PipelineError(
        this.id,
        'upstream_error',
        'response missing base64_images[0]',
      );
    }

    const metadata: Record<string, unknown> = {
      pipeline: this.id,
      promptStyle,
      numImages,
    };
    if (typeof json['credit_cost'] === 'number') metadata['creditCost'] = json['credit_cost'];
    if (typeof json['remaining_credits'] === 'number') metadata['remainingCredits'] = json['remaining_credits'];

    return {
      kind: 'image',
      data: base64ToBytes(first),
      mimeType: 'image/png',
      width,
      height,
      metadata,
    };
  }
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

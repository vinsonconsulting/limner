import { assertSecrets, PipelineError } from './errors.js';
import { parseSize } from './_http.js';
import type {
  PipelineContext,
  PipelineGenerateInput,
  PipelineGenerateOutput,
  PipelineRunner,
} from './types.js';

// D-RA-25 (amends D-RA-14): Recraft is called via direct REST
// (external.api.recraft.ai). RestRecraftTransport (pipelines/recraft-rest.ts)
// is the production implementation; the pipeline depends only on the
// RecraftTransport seam below, so the wire protocol is swappable. The
// transport DI seam stays available as the "composed adapter" pattern for any
// future pipeline that needs to wrap an external surface.

export type RecraftOptions = {
  style?: 'digital_illustration' | 'vector_illustration' | 'realistic_image' | (string & {});
  substyle?: string;
  model?: 'recraftv3' | 'recraftv2' | (string & {});
  size?: '1024x1024' | '1365x1024' | '1024x1365' | (string & {});
  // #15 native image-input. A source image URL — when set, the transport calls
  // Recraft's image-to-image endpoint instead of text-to-image. URL, not inline
  // base64 (it never rides the MCP wire).
  image?: string;
  // Image-to-image strength 0-1 (lower = closer to the source). Default 0.5.
  strength?: number;
};

// Arguments passed through to the Recraft transport. `image`/`strength` select
// the image-to-image path.
export type RecraftGenerateArgs = {
  prompt: string;
  size: string;
  style: string;
  substyle?: string;
  model?: string;
  image?: string;
  strength?: number;
};

// Result returned by a RecraftTransport. Mirrors PipelineImageOutput's
// shape but stays a separate type so transport implementations don't
// import the pipeline output type.
export type RecraftGenerateResult = {
  url?: string;
  data?: Uint8Array;
  mimeType?: string;
  width?: number;
  height?: number;
  raw?: unknown;
};

// The minimum surface RecraftPipeline depends on. Default impl is a
// Phase-2-v1 placeholder; real MCP SDK wiring (StreamableHTTPClientTransport
// for remote, StdioClientTransport for local) lands in Phase 4 when the MCP
// server itself ships.
export interface RecraftTransport {
  generateImage(args: RecraftGenerateArgs): Promise<RecraftGenerateResult>;
  close?(): Promise<void>;
}

const DEFAULT_SIZE = '1024x1024';
const DEFAULT_STYLE = 'realistic_image';

export class RecraftPipeline implements PipelineRunner {
  readonly id = 'recraft';
  readonly displayName = 'Recraft';
  // Direct REST (D-RA-25), same as the other API-backed pipelines.
  readonly kind = 'api' as const;
  readonly requiredSecrets: readonly string[] = ['RECRAFT_API_KEY'];

  private readonly transportImpl: RecraftTransport;

  constructor(transportImpl?: RecraftTransport) {
    this.transportImpl = transportImpl ?? makePlaceholderTransport();
  }

  async generate(
    input: PipelineGenerateInput,
    ctx: PipelineContext,
  ): Promise<PipelineGenerateOutput> {
    assertSecrets(this.id, this.requiredSecrets, ctx.secrets);

    const prompt = input.prompt.trim();
    if (prompt.length === 0) {
      throw new PipelineError(this.id, 'invalid_input', 'prompt is required and must be non-empty');
    }

    const opts = (input.options ?? {}) as RecraftOptions;
    const args: RecraftGenerateArgs = {
      prompt,
      size: opts.size ?? DEFAULT_SIZE,
      style: opts.style ?? DEFAULT_STYLE,
      ...(opts.substyle ? { substyle: opts.substyle } : {}),
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.image ? { image: opts.image } : {}),
      ...(opts.strength !== undefined ? { strength: opts.strength } : {}),
    };

    let result: RecraftGenerateResult;
    try {
      result = await this.transportImpl.generateImage(args);
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      throw new PipelineError(
        this.id,
        'upstream_error',
        `recraft transport error: ${stringifyError(err)}`,
        err,
      );
    }

    // At least one of url/data must be set — same invariant as
    // PipelineImageOutput.
    if (!result.url && !result.data) {
      throw new PipelineError(
        this.id,
        'upstream_error',
        'recraft transport returned neither url nor data',
      );
    }

    const [w, h] = parseSize(args.size);
    const metadata: Record<string, unknown> = {
      pipeline: this.id,
      style: args.style,
      size: args.size,
    };
    if (args.substyle) metadata['substyle'] = args.substyle;
    if (args.model) metadata['model'] = args.model;
    // r3: result.raw (the full upstream MCP response, which can include the
    // base64 image content block) stays on RecraftGenerateResult for
    // transport-level debugging but must NOT enter pipeline metadata —
    // formatImageOutput spreads metadata into structuredContent, so the
    // image bytes would ride the CallToolResult twice.

    return {
      kind: 'image',
      ...(result.url ? { url: result.url } : {}),
      ...(result.data ? { data: result.data } : {}),
      mimeType: result.mimeType ?? 'image/png',
      width: result.width ?? w,
      height: result.height ?? h,
      metadata,
    };
  }

  // Best-effort cleanup; safe to call on any transport including the
  // placeholder.
  async close(): Promise<void> {
    if (this.transportImpl.close) await this.transportImpl.close();
  }
}

// Default transport when none is injected. Throws on use with a clear
// pointer to the production impl. Production wires RestRecraftTransport
// (pipelines/recraft-rest.ts); tests inject a double.
function makePlaceholderTransport(): RecraftTransport {
  return {
    async generateImage(): Promise<RecraftGenerateResult> {
      throw new PipelineError(
        'recraft',
        'upstream_unavailable',
        'No RecraftTransport provided; construct RecraftPipeline with a ' +
          'RestRecraftTransport (pipelines/recraft-rest.ts) or inject a test double.',
      );
    },
  };
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

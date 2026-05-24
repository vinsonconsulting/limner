import { assertSecrets, PipelineError } from './errors.js';
import type {
  PipelineContext,
  PipelineGenerateInput,
  PipelineGenerateOutput,
  PipelineRunner,
} from './types.js';

// D-RA-14: Recraft is integrated as a composed-MCP adapter rather than a
// direct REST client. The adapter normalizes Recraft's first-party MCP
// tools into rasa's pipeline surface, giving uniform error mapping,
// telemetry, and naming alongside the API-backed pipelines.
//
// Two transport modes:
//   - 'remote': mcp.recraft.ai/mcp (Streamable HTTP, API-key header auth)
//   - 'local':  github.com/recraft-ai/mcp-recraft-server (stdio process)
//
// Sets precedent for any future composed-MCP pipeline.

export type RecraftMode = 'remote' | 'local';

export type RecraftOptions = {
  style?: 'digital_illustration' | 'vector_illustration' | 'realistic_image' | (string & {});
  substyle?: string;
  model?: 'recraftv3' | 'recraftv2' | (string & {});
  size?: '1024x1024' | '1365x1024' | '1024x1365' | (string & {});
};

// Arguments passed through to Recraft's MCP generate_image tool.
export type RecraftGenerateArgs = {
  prompt: string;
  size: string;
  style: string;
  substyle?: string;
  model?: string;
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
  readonly kind = 'mcp-adapter' as const;
  // Reflects the architectural transport mode (matches ComposedMcpPipeline.transport).
  readonly transport: 'remote-http' | 'local-stdio';
  readonly requiredSecrets: readonly string[];

  private readonly transportImpl: RecraftTransport;

  constructor(mode: RecraftMode = 'remote', transportImpl?: RecraftTransport) {
    this.transport = mode === 'remote' ? 'remote-http' : 'local-stdio';
    // Remote mode requires an API key for mcp.recraft.ai header auth.
    // Local stdio mode doesn't (the user's Recraft server handles its own
    // auth, typically env-based, outside Limner's secret surface).
    this.requiredSecrets = mode === 'remote' ? ['RECRAFT_API_KEY'] : [];
    this.transportImpl = transportImpl ?? makePlaceholderTransport(mode);
  }

  async generate(
    input: PipelineGenerateInput,
    ctx: PipelineContext,
  ): Promise<PipelineGenerateOutput> {
    if (this.transport === 'remote-http') {
      assertSecrets(this.id, this.requiredSecrets, ctx.secrets);
    }

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
      transport: this.transport,
      style: args.style,
      size: args.size,
    };
    if (args.substyle) metadata['substyle'] = args.substyle;
    if (args.model) metadata['model'] = args.model;
    if (result.raw !== undefined) metadata['raw'] = result.raw;

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
// pointer to where the real impl is expected to land. Lets the pipeline
// surface compile and be wired into the MCP server now, without forcing
// the full @modelcontextprotocol/sdk Client + transport plumbing into
// Phase 2.
function makePlaceholderTransport(mode: RecraftMode): RecraftTransport {
  return {
    async generateImage(): Promise<RecraftGenerateResult> {
      throw new PipelineError(
        'recraft',
        'upstream_unavailable',
        `Default ${mode} transport not implemented in Phase 2 v1; ` +
          `pass a RecraftTransport implementation to the RecraftPipeline ` +
          `constructor (Phase 4 will ship an MCP-SDK-backed default).`,
      );
    },
  };
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

// ---------------- Input / Output ----------------

// Common fields supported by every pipeline. Pipeline-specific knobs go
// under `options` and are validated by the pipeline itself (or by the
// caller's zod schema at the MCP boundary).
export type PipelineGenerateInput = {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  // Pipeline-specific options; each pipeline documents its shape.
  options?: Record<string, unknown>;
};

// Pipelines either return text (Midjourney composes a prompt, no image
// generation) or an image (URL from upstream, raw bytes, or both — at least
// one must be present in the image variant).
export type PipelineTextOutput = {
  kind: 'text';
  content: string;
  metadata?: Record<string, unknown>;
};

export type PipelineImageOutput = {
  kind: 'image';
  // At least one of `url` or `data` is set. The caller is responsible for
  // R2 storage / URL persistence if both are needed in a different shape.
  url?: string;
  data?: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
};

export type PipelineGenerateOutput = PipelineTextOutput | PipelineImageOutput;

// ---------------- Execution context ----------------

// PipelineContext is assembled by the caller (MCP server / CMA tool) from
// the right credential source — Cloudflare Secrets in Workers mode,
// process.env in stdio mode. Pipelines never read env directly.
export type PipelineContext = {
  secrets: Readonly<Record<string, string>>;
  abortSignal?: AbortSignal;
};

// ---------------- Runner contract ----------------

// PipelineRunner is a standalone contract — it does NOT extend AnyPipeline
// because TS interfaces cannot extend a union type. The runner carries the
// same id/displayName/kind metadata as the marker interfaces in ../types.ts,
// so a runner instance is structurally assignable to ApiBackedPipeline or
// ComposedMcpPipeline depending on its `kind` value.
export interface PipelineRunner {
  readonly id: string;
  readonly displayName: string;
  readonly kind: 'api' | 'mcp-adapter';

  // Secret keys this pipeline requires to operate. Enables pre-flight
  // credential checks and surfaces credential UX requirements upstream.
  // Empty array for prompt-only pipelines (Midjourney).
  readonly requiredSecrets: readonly string[];

  generate(
    input: PipelineGenerateInput,
    ctx: PipelineContext,
  ): Promise<PipelineGenerateOutput>;
}

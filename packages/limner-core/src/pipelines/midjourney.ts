import { PipelineError } from './errors.js';
import type {
  PipelineContext,
  PipelineGenerateInput,
  PipelineGenerateOutput,
  PipelineRunner,
} from './types.js';

// Supported Midjourney parameters in Phase 2 v1. Additional knobs (--cw,
// --sw, --iw, --repeat) can be added as user demand surfaces.
export type MidjourneyOptions = {
  // Aspect ratio in N:N form (e.g. "16:9", "1:1", "3:2").
  aspectRatio?: string;
  // Model version. 'niji-N' routes to --niji; everything else to --v.
  version?: 'v5' | 'v5.1' | 'v5.2' | 'v6' | 'v6.1' | 'v7' | 'niji-5' | 'niji-6';
  // Style preset or freeform string.
  style?: 'raw' | 'cute' | 'expressive' | 'original' | 'scenic' | (string & {});
  stylize?: number; // 0..1000
  weird?: number;   // 0..3000
  chaos?: number;   // 0..100
  tile?: boolean;
  // Negative prompt terms; merged with PipelineGenerateInput.negativePrompt.
  no?: string[];
  // Options.seed takes precedence over PipelineGenerateInput.seed when both
  // are set (the pipeline-specific knob wins over the generic convenience
  // field). Document explicitly to avoid caller confusion.
  seed?: number;
  quality?: 0.25 | 0.5 | 1 | 2;
  // #15 native image-input. Midjourney composes a prompt string (HITL), so
  // image-input is by reference, not upload:
  //   image    -> image-prompt URL, prepended to the prompt (+ --iw weight)
  //   styleRef -> --sref <url> (style reference)
  //   omniRef  -> --oref <url> (v7 omni/character reference)
  image?: string;
  imageWeight?: number; // --iw, 0..3 (default 1)
  styleRef?: string;
  omniRef?: string;
};

// Midjourney is unusual in Limner's pipeline set: it does not call any
// upstream API. It composes a prompt string the user pastes into Discord
// (or another MJ surface). The pipeline contract is still useful here for
// uniform tool registration and discovery.
export class MidjourneyPipeline implements PipelineRunner {
  readonly id = 'midjourney';
  readonly displayName = 'Midjourney';
  readonly kind = 'api' as const; // Treated as first-party direct; no MCP adapter wrapping.
  readonly requiredSecrets: readonly string[] = [];

  async generate(
    input: PipelineGenerateInput,
    _ctx: PipelineContext,
  ): Promise<PipelineGenerateOutput> {
    const prompt = input.prompt.trim();
    if (prompt.length === 0) {
      throw new PipelineError(this.id, 'invalid_input', 'prompt is required and must be non-empty');
    }

    const opts = (input.options ?? {}) as MidjourneyOptions;

    // Light range validation; the MCP zod schema (Phase 4) is the strict layer.
    if (opts.stylize !== undefined && (opts.stylize < 0 || opts.stylize > 1000)) {
      throw new PipelineError(this.id, 'invalid_input', `stylize out of range (0-1000): ${opts.stylize}`);
    }
    if (opts.weird !== undefined && (opts.weird < 0 || opts.weird > 3000)) {
      throw new PipelineError(this.id, 'invalid_input', `weird out of range (0-3000): ${opts.weird}`);
    }
    if (opts.chaos !== undefined && (opts.chaos < 0 || opts.chaos > 100)) {
      throw new PipelineError(this.id, 'invalid_input', `chaos out of range (0-100): ${opts.chaos}`);
    }
    if (opts.aspectRatio !== undefined && !/^\d+:\d+$/.test(opts.aspectRatio)) {
      throw new PipelineError(
        this.id,
        'invalid_input',
        `aspectRatio must be N:N format (e.g. 16:9): ${opts.aspectRatio}`,
      );
    }
    if (opts.imageWeight !== undefined && (opts.imageWeight < 0 || opts.imageWeight > 3)) {
      throw new PipelineError(this.id, 'invalid_input', `imageWeight out of range (0-3): ${opts.imageWeight}`);
    }
    for (const [name, value] of [['image', opts.image], ['styleRef', opts.styleRef], ['omniRef', opts.omniRef]] as const) {
      if (value !== undefined && !/^https?:\/\/\S+$/.test(value)) {
        throw new PipelineError(this.id, 'invalid_input', `${name} must be an http(s) image URL: ${value}`);
      }
    }

    // Image-prompt URL goes at the START of the prompt (Midjourney syntax);
    // the text prompt and flags follow.
    const parts: string[] = [];
    if (opts.image) parts.push(opts.image);
    parts.push(prompt);

    // Negative prompts: union of input.negativePrompt and opts.no.
    const negatives: string[] = [];
    if (input.negativePrompt) negatives.push(input.negativePrompt);
    if (opts.no) negatives.push(...opts.no);
    if (negatives.length > 0) {
      parts.push(`--no ${negatives.join(', ')}`);
    }

    if (opts.aspectRatio) parts.push(`--ar ${opts.aspectRatio}`);

    if (opts.version) {
      if (opts.version.startsWith('niji-')) {
        parts.push(`--niji ${opts.version.slice('niji-'.length)}`);
      } else {
        parts.push(`--v ${opts.version.slice('v'.length)}`);
      }
    }

    if (opts.style) parts.push(`--style ${opts.style}`);
    if (opts.stylize !== undefined) parts.push(`--stylize ${opts.stylize}`);
    if (opts.weird !== undefined) parts.push(`--weird ${opts.weird}`);
    if (opts.chaos !== undefined) parts.push(`--chaos ${opts.chaos}`);
    if (opts.tile) parts.push('--tile');

    const seed = opts.seed ?? input.seed;
    if (seed !== undefined) parts.push(`--seed ${seed}`);

    if (opts.quality !== undefined) parts.push(`--q ${opts.quality}`);

    // Image-input flags (#15): --iw applies to the image prompt; --sref / --oref
    // are reference-image URLs.
    if (opts.imageWeight !== undefined) parts.push(`--iw ${opts.imageWeight}`);
    if (opts.styleRef) parts.push(`--sref ${opts.styleRef}`);
    if (opts.omniRef) parts.push(`--oref ${opts.omniRef}`);

    return {
      kind: 'text',
      content: parts.join(' '),
      metadata: {
        pipeline: this.id,
        options: opts,
        ...(input.negativePrompt ? { negativePrompt: input.negativePrompt } : {}),
      },
    };
  }
}

// Pure Test-4 harness logic (SDK-free, fs-free), mirroring the agent-def.ts /
// create-agent.ts split. Everything here can be validated without credentials,
// a network, or real spend; the live SDK orchestration lives in test-agent.ts.
//
// Responsibilities:
//   - assemble the user.message content (text + optional base64 image),
//   - extract saved/rendered assets from an MCP tool_result's content blocks,
//   - unmask session.error events (esp. the model_request_failed_error class
//     that can hide a tool-schema invalid_request_error — the Test-4 headline),
//   - reduce a session's event stream into a structured per-task transcript,
//   - score a transcript against the Test-4 pass/fail criteria.
//
// The agent-facing copy carries the A4 third-party framing: Limner is an
// independent project on Anthropic's CMA platform, not an Anthropic/Claude
// product.

import { Buffer } from 'node:buffer';

// ---------------- agent-facing copy (A4-framed) ----------------

/** Third-party framing prepended to every agent-facing task prompt (A4). */
export const A4_PREAMBLE =
  'Context: this is an asset-generation test for Limner — an independent, third-party ' +
  'image tool built on the CMA platform (not an Anthropic or Claude product).';

function generatePrompt(pipelineLabel: string, toolName: string, extra?: string): string {
  return [
    A4_PREAMBLE,
    '',
    'Task: From the attached source photograph, produce a Beaux-Arts oil-painting portrait.',
    'Steps:',
    "  1. Look at the photo and write a description of the subject's visible features " +
      '(pose, lighting, hair, attire, mood). Do NOT attempt to identify the person — ' +
      'describe features only.',
    '  2. Compose a single Beaux-Arts oil-painting portrait prompt from that description.',
    `  3. Generate it through the ${pipelineLabel} pipeline by calling ${toolName}.`,
    'Report the feature description and the exact prompt you composed.',
    ...(extra ? ['', extra] : []),
  ].join('\n');
}

/** Format-advice task — exercises the file-types skill (print vs web). */
export const FORMAT_ADVICE_PROMPT = [
  A4_PREAMBLE,
  '',
  'Task: For delivering a finished Beaux-Arts oil-painting portrait, advise the best image ' +
    'file format(s) for (a) fine-art / gallery print and (b) web display. Briefly explain the ' +
    'trade-offs — compression, color model (RGB vs CMYK), transparency, and resolution. ' +
    'Consult the file-types skill.',
].join('\n');

// ---------------- task set (fixed, bounded, staged by cost) ----------------

export interface TaskSpec {
  /** Stable id, also used to name the session and output files. */
  id: string;
  /** 1 = free (no pipeline spend); 2 = paid. */
  stage: 1 | 2;
  /** 'generate' calls a pipeline tool; 'advice' is reasoning + skill use. */
  kind: 'generate' | 'advice';
  /** The pipeline tool the agent is expected to select (generate tasks). */
  expectedTool?: string;
  /** What a successful generate returns: an image, or just a composed prompt. */
  assetKind?: 'image' | 'prompt';
  /** Whether the source photo is attached to the user turn. */
  attachImage: boolean;
  /** The agent-facing prompt (A4-framed). */
  prompt: string;
}

/** Stage 1 — free: proves wiring, schema, skill, and vision at zero pipeline cost. */
export const STAGE1_TASKS: readonly TaskSpec[] = [
  {
    id: 'portrait-midjourney',
    stage: 1,
    kind: 'generate',
    expectedTool: 'limner_generate_midjourney',
    assetKind: 'prompt',
    attachImage: true,
    prompt: generatePrompt('Midjourney', 'limner_generate_midjourney'),
  },
  {
    id: 'format-advice',
    stage: 1,
    kind: 'advice',
    attachImage: false,
    prompt: FORMAT_ADVICE_PROMPT,
  },
];

/** Stage 2 — paid: the comparable DALL·E + Recraft renditions of the same brief. */
export const STAGE2_TASKS: readonly TaskSpec[] = [
  {
    id: 'portrait-dalle',
    stage: 2,
    kind: 'generate',
    expectedTool: 'limner_generate_dalle',
    assetKind: 'image',
    attachImage: true,
    // Steer to gpt-image-1: the live dogfood found dall-e-3 / dall-e-2 are
    // retired on the account (only gpt-image-* remain), and the agent otherwise
    // picks the dead dall-e-3 and gets a 400.
    prompt: generatePrompt(
      'DALL·E',
      'limner_generate_dalle',
      'Use the gpt-image-1 model (pass model: "gpt-image-1"). dall-e-3 and dall-e-2 are ' +
        'retired and unavailable on this account.',
    ),
  },
  {
    id: 'portrait-recraft',
    stage: 2,
    kind: 'generate',
    expectedTool: 'limner_generate_recraft',
    assetKind: 'image',
    attachImage: true,
    prompt: generatePrompt('Recraft', 'limner_generate_recraft'),
  },
];

/** Optional Stage-2 compose pass (renderText) — opt-in via the entry point. */
export const COMPOSE_TASK: TaskSpec = {
  id: 'compose-caption',
  stage: 2,
  kind: 'generate',
  expectedTool: 'limner_compose',
  assetKind: 'image',
  attachImage: false,
  prompt: [
    A4_PREAMBLE,
    '',
    'Task: Using limner_compose (renderText), produce a small framed caption card for the ' +
      'portrait — e.g. overlay the title "Beaux-Arts Study" in a serif face on a neutral panel. ' +
      'Return the composed image.',
  ].join('\n'),
};

// ---------------- user-message assembly ----------------

export interface ContentBlockText {
  type: 'text';
  text: string;
}
export interface ContentBlockImage {
  type: 'image';
  source: { type: 'base64'; data: string; media_type: string };
}
export type UserContentBlock = ContentBlockText | ContentBlockImage;

/** Build the user.message content array: text, plus an optional base64 image. */
export function buildUserMessageContent(
  promptText: string,
  image?: { data: string; mediaType: string },
): UserContentBlock[] {
  const blocks: UserContentBlock[] = [{ type: 'text', text: promptText }];
  if (image) {
    blocks.push({ type: 'image', source: { type: 'base64', data: image.data, media_type: image.mediaType } });
  }
  return blocks;
}

// ---------------- asset extraction ----------------

export type Asset =
  | { kind: 'image'; base64: string; mediaType: string; ext: string }
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string };

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
  'image/svg+xml': 'svg',
};

/** Map an image MIME type to a file extension; 'bin' for anything unknown. */
export function extForMediaType(mediaType: string | undefined): string {
  if (!mediaType) return 'bin';
  return MIME_EXT[mediaType.toLowerCase()] ?? 'bin';
}

type AnyBlock = { type?: string; [k: string]: unknown };

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Extract assets from an MCP tool_result content array. Handles both the CMA
 * ImageBlock shape ({type:'image', source:{type:'base64'|'url', ...}}) and the
 * raw MCP image shape ({type:'image', data, mimeType}), URL-bearing text blocks,
 * and plain text (e.g. a composed Midjourney prompt). Order is preserved.
 */
export function extractAssets(content: readonly AnyBlock[]): Asset[] {
  const assets: Asset[] = [];
  for (const block of content) {
    if (block.type === 'image') {
      const source = block.source as AnyBlock | undefined;
      if (source && typeof source === 'object') {
        if (source.type === 'base64') {
          const data = asString(source.data);
          const mediaType = asString(source.media_type) ?? 'image/png';
          if (data) assets.push({ kind: 'image', base64: data, mediaType, ext: extForMediaType(mediaType) });
          continue;
        }
        if (source.type === 'url') {
          const url = asString(source.url);
          if (url) assets.push({ kind: 'url', url });
          continue;
        }
      }
      // Raw MCP shape: { type:'image', data, mimeType }.
      const data = asString(block.data);
      if (data) {
        const mediaType = asString(block.mimeType) ?? asString(block.media_type) ?? 'image/png';
        assets.push({ kind: 'image', base64: data, mediaType, ext: extForMediaType(mediaType) });
      }
      continue;
    }
    if (block.type === 'text') {
      const text = asString(block.text) ?? '';
      const trimmed = text.trim();
      // A bare URL, OR the PR-D asset-delivery envelope: the MCP image tools
      // return the URL in structuredContent, which the CMA agent surfaces as a
      // JSON text block ({"pipeline":...,"url":"https://.../artifact/..."}).
      // Pull the url out of either so a stored-asset result counts as an asset.
      const url = /^https?:\/\/\S+$/.test(trimmed) ? trimmed : urlFromJson(trimmed);
      if (url) {
        assets.push({ kind: 'url', url });
      } else {
        assets.push({ kind: 'text', text });
      }
    }
    // document / search_result blocks are ignored for asset capture.
  }
  return assets;
}

// Extract a `url` string field from a JSON text block (the PR-D image-tool
// envelope). Returns undefined for non-JSON text or JSON without an http(s) url.
function urlFromJson(text: string): string | undefined {
  if (!text.startsWith('{') && !text.startsWith('[')) return undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return undefined;
    const url = (parsed as Record<string, unknown>)['url'];
    return typeof url === 'string' && /^https?:\/\//.test(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

/** A base64-free descriptor of an asset, safe to write into the JSON artifact. */
export type ArtifactAsset =
  | { kind: 'image'; mediaType: string; ext: string; bytes: number; savedAs?: string }
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string };

/**
 * Reduce an Asset to a base64-free artifact descriptor. Image bytes are NEVER
 * serialized — only the decoded byte count and the saved filename — so the
 * transcript artifact can't leak the source photo or generated pixels.
 */
export function summarizeAssetForArtifact(asset: Asset, savedAs?: string): ArtifactAsset {
  if (asset.kind === 'image') {
    return {
      kind: 'image',
      mediaType: asset.mediaType,
      ext: asset.ext,
      bytes: Buffer.from(asset.base64, 'base64').length,
      ...(savedAs ? { savedAs } : {}),
    };
  }
  return asset;
}

// ---------------- session.error unmasking ----------------

export interface UnmaskedError {
  type: string;
  message: string;
  retryStatus?: string;
  mcpServerName?: string;
  /** The model_request_failed_error class — can hide a tool-schema rejection. */
  isMaskedModelRequestFailure: boolean;
  isMcpAuthFailure: boolean;
  isMcpConnFailure: boolean;
  /** The verbatim error event, preserved for the report (no detail dropped). */
  raw: unknown;
}

/** Normalize a session.error event into a structured, fully-preserved record. */
export function unmaskError(errorEvent: AnyBlock): UnmaskedError {
  const error = (errorEvent.error ?? {}) as AnyBlock;
  const type = asString(error.type) ?? 'unknown';
  const retry = error.retry_status as AnyBlock | undefined;
  return {
    type,
    message: asString(error.message) ?? '',
    retryStatus: retry ? asString(retry.type) : undefined,
    mcpServerName: asString(error.mcp_server_name),
    isMaskedModelRequestFailure: type === 'model_request_failed_error',
    isMcpAuthFailure: type === 'mcp_authentication_failed_error',
    isMcpConnFailure: type === 'mcp_connection_failed_error',
    raw: errorEvent,
  };
}

// ---------------- event reduction ----------------

export interface RecordedToolCall {
  id: string;
  name: string;
  mcpServerName: string;
  input: unknown;
  resultContent?: AnyBlock[];
  isError?: boolean;
  assets: Asset[];
}

export interface TaskTranscript {
  thinkingCount: number;
  modelRequests: number;
  toolCalls: RecordedToolCall[];
  /** One entry per agent.message (text blocks concatenated). */
  agentText: string[];
  /** All agent message text joined with newlines. */
  finalText: string;
  errors: UnmaskedError[];
  /** stop_reason.type from the last session.status_idle event. */
  idleStopReason?: string;
  terminated: boolean;
}

type SessionEventLike = AnyBlock;

/** Reduce a session's events into a structured, capturable per-task transcript. */
export function reduceEvents(events: readonly SessionEventLike[]): TaskTranscript {
  const toolCalls: RecordedToolCall[] = [];
  const byId = new Map<string, RecordedToolCall>();
  const agentText: string[] = [];
  const errors: UnmaskedError[] = [];
  let thinkingCount = 0;
  let modelRequests = 0;
  let idleStopReason: string | undefined;
  let terminated = false;

  for (const ev of events) {
    switch (ev.type) {
      case 'agent.thinking':
        thinkingCount++;
        break;
      case 'span.model_request_start':
        modelRequests++;
        break;
      case 'agent.mcp_tool_use': {
        const call: RecordedToolCall = {
          id: asString(ev.id) ?? '',
          name: asString(ev.name) ?? '(unknown)',
          mcpServerName: asString(ev.mcp_server_name) ?? '',
          input: ev.input,
          assets: [],
        };
        toolCalls.push(call);
        if (call.id) byId.set(call.id, call);
        break;
      }
      case 'agent.mcp_tool_result': {
        const useId = asString(ev.mcp_tool_use_id) ?? '';
        const content = (Array.isArray(ev.content) ? (ev.content as AnyBlock[]) : []) ?? [];
        const assets = extractAssets(content);
        let call = byId.get(useId);
        if (!call) {
          // Orphan result (use event not seen): keep the assets anyway.
          call = { id: useId, name: '(unknown)', mcpServerName: '', input: undefined, assets: [] };
          toolCalls.push(call);
        }
        call.resultContent = content;
        call.isError = typeof ev.is_error === 'boolean' ? ev.is_error : undefined;
        call.assets = assets;
        break;
      }
      case 'agent.message': {
        const content = Array.isArray(ev.content) ? (ev.content as AnyBlock[]) : [];
        const text = content
          .filter((b) => b.type === 'text')
          .map((b) => asString(b.text) ?? '')
          .join('');
        agentText.push(text);
        break;
      }
      case 'session.error':
        errors.push(unmaskError(ev));
        break;
      case 'session.status_idle': {
        const stop = ev.stop_reason as AnyBlock | undefined;
        idleStopReason = stop ? asString(stop.type) : undefined;
        break;
      }
      case 'session.status_terminated':
        terminated = true;
        break;
      default:
        break;
    }
  }

  return {
    thinkingCount,
    modelRequests,
    toolCalls,
    agentText,
    finalText: agentText.join('\n'),
    errors,
    idleStopReason,
    terminated,
  };
}

// ---------------- file-types skill signal ----------------

const PRINT_TERMS = /\b(tiff|pdf|cmyk|dpi|print)\b/i;
const WEB_TERMS = /\b(webp|avif|web|rgb)\b/i;

/**
 * Heuristic for "the file-types skill influenced the answer": the response
 * distinguishes a print-oriented format/term from a web-oriented one — the
 * exact print-vs-web distinction the skill encodes (CMYK/TIFF/PDF for print,
 * RGB/WebP/AVIF for web).
 */
export function fileTypesSkillSignal(text: string): boolean {
  return PRINT_TERMS.test(text) && WEB_TERMS.test(text);
}

// ---------------- pass/fail evaluation ----------------

export interface CriterionResult {
  name: string;
  pass: boolean;
  detail: string;
}

export interface TaskResult {
  taskId: string;
  criteria: CriterionResult[];
  pass: boolean;
}

/**
 * Normalize an MCP tool name for comparison. CMA exposes the limner tools to the
 * model under their bare names (e.g. `generate_midjourney`, server `limner`),
 * stripping the registered `limner_` server-prefix — so the registered name
 * `limner_generate_midjourney` and the observed `generate_midjourney` must
 * compare equal. (Verified against the live agent during Test 4.)
 */
export function normalizeToolName(name: string): string {
  return name.replace(/^limner_/, '');
}

/** Score a reduced transcript against the Test-4 criteria for its task kind. */
export function evaluateTask(transcript: TaskTranscript, spec: TaskSpec): TaskResult {
  const criteria: CriterionResult[] = [];

  // Headline: the live Messages API accepted the tool schemas — i.e. no masked
  // model_request_failed_error fired.
  const masked = transcript.errors.filter((e) => e.isMaskedModelRequestFailure);
  criteria.push({
    name: 'schemasAccepted',
    pass: masked.length === 0,
    detail:
      masked.length === 0
        ? 'no model_request_failed_error'
        : `model_request_failed_error: ${masked.map((m) => m.message).join('; ')}`,
  });

  if (spec.kind === 'generate') {
    const mcpFailed = transcript.errors.some((e) => e.isMcpAuthFailure || e.isMcpConnFailure);
    criteria.push({
      name: 'mcpToolsReached',
      pass: transcript.toolCalls.length > 0 && !mcpFailed,
      detail: mcpFailed
        ? 'MCP auth/connection error fired'
        : `${transcript.toolCalls.length} MCP tool call(s)`,
    });

    const wantTool = spec.expectedTool ? normalizeToolName(spec.expectedTool) : undefined;
    const calledExpected = wantTool
      ? transcript.toolCalls.some((c) => normalizeToolName(c.name) === wantTool)
      : transcript.toolCalls.length > 0;
    criteria.push({
      name: 'toolSelectionAppropriate',
      pass: calledExpected,
      detail: calledExpected
        ? `called ${spec.expectedTool ?? 'a pipeline tool'}`
        : `expected ${spec.expectedTool}; saw ${transcript.toolCalls.map((c) => c.name).join(', ') || 'none'}`,
    });

    const derived = transcript.toolCalls.find((c) => {
      const input = c.input as AnyBlock | undefined;
      const prompt = input ? asString(input.prompt) : undefined;
      return (
        (!wantTool || normalizeToolName(c.name) === wantTool) && !!prompt && prompt.trim().length > 0
      );
    });
    criteria.push({
      name: 'visionDerivedPrompt',
      pass: !!derived,
      detail: derived ? 'non-empty derived prompt in the tool input' : 'no derived prompt captured',
    });

    const hasAsset = transcript.toolCalls.some((c) =>
      spec.assetKind === 'image'
        ? c.assets.some((a) => a.kind === 'image' || a.kind === 'url')
        : c.assets.length > 0,
    );
    criteria.push({
      name: 'assetProduced',
      pass: hasAsset,
      detail: hasAsset ? `asset(s) captured` : 'no asset captured',
    });
  } else {
    const skill = fileTypesSkillSignal(transcript.finalText);
    criteria.push({
      name: 'fileTypesSkillUsed',
      pass: skill,
      detail: skill
        ? 'answer distinguishes print vs web formats'
        : 'no file-types skill signal in the answer',
    });
  }

  return { taskId: spec.id, criteria, pass: criteria.every((c) => c.pass) };
}

// Tests for the pure Test-4 harness logic (SDK-free, fs-free): user-message
// assembly, asset extraction from MCP results, session.error unmasking, the
// event reducer, the file-types skill signal, and the pass/fail evaluator.
//
// These mirror the agent-def.ts / create-agent.ts split: the logic under test
// here is the part that can be validated without credentials, a network, or
// real spend. The live SDK orchestration in test-agent.ts is exercised by the
// staged run, not by unit tests.

import { describe, expect, test } from 'vitest';

import {
  A4_PREAMBLE,
  STAGE1_TASKS,
  STAGE2_TASKS,
  buildUserMessageContent,
  extForMediaType,
  extractAssets,
  unmaskError,
  reduceEvents,
  fileTypesSkillSignal,
  evaluateTask,
  summarizeAssetForArtifact,
  normalizeToolName,
  type TaskSpec,
} from '../src/test-harness.js';

describe('buildUserMessageContent', () => {
  test('text-only message produces a single text block', () => {
    const content = buildUserMessageContent('compose a portrait prompt');
    expect(content).toEqual([{ type: 'text', text: 'compose a portrait prompt' }]);
  });

  test('with an image produces a text block followed by a base64 image block', () => {
    const content = buildUserMessageContent('describe and compose', {
      data: 'QUJD',
      mediaType: 'image/jpeg',
    });
    expect(content).toEqual([
      { type: 'text', text: 'describe and compose' },
      { type: 'image', source: { type: 'base64', data: 'QUJD', media_type: 'image/jpeg' } },
    ]);
  });
});

describe('extForMediaType', () => {
  test('maps common image mime types to file extensions', () => {
    expect(extForMediaType('image/png')).toBe('png');
    expect(extForMediaType('image/jpeg')).toBe('jpg');
    expect(extForMediaType('image/webp')).toBe('webp');
    expect(extForMediaType('image/gif')).toBe('gif');
  });

  test('falls back to bin for unknown mime types', () => {
    expect(extForMediaType('application/octet-stream')).toBe('bin');
    expect(extForMediaType(undefined)).toBe('bin');
  });
});

describe('extractAssets', () => {
  test('extracts a base64 image from the CMA ImageBlock shape (source)', () => {
    const assets = extractAssets([
      { type: 'image', source: { type: 'base64', data: 'SU1H', media_type: 'image/png' } },
    ]);
    expect(assets).toEqual([{ kind: 'image', base64: 'SU1H', mediaType: 'image/png', ext: 'png' }]);
  });

  test('extracts a url from the CMA ImageBlock url source', () => {
    const assets = extractAssets([
      { type: 'image', source: { type: 'url', url: 'https://cdn.example/x.png' } },
    ]);
    expect(assets).toEqual([{ kind: 'url', url: 'https://cdn.example/x.png' }]);
  });

  test('extracts a base64 image from the raw MCP image shape (data + mimeType)', () => {
    const assets = extractAssets([{ type: 'image', data: 'Ukk=', mimeType: 'image/webp' }]);
    expect(assets).toEqual([{ kind: 'image', base64: 'Ukk=', mediaType: 'image/webp', ext: 'webp' }]);
  });

  test('classifies a text block holding a URL as a url asset', () => {
    const assets = extractAssets([{ type: 'text', text: 'https://r2.example/out.png' }]);
    expect(assets).toEqual([{ kind: 'url', url: 'https://r2.example/out.png' }]);
  });

  test('classifies a non-URL text block (e.g. a Midjourney prompt) as a text asset', () => {
    const assets = extractAssets([
      { type: 'text', text: 'oil portrait, chiaroscuro --ar 4:5 --stylize 200' },
    ]);
    expect(assets).toEqual([
      { kind: 'text', text: 'oil portrait, chiaroscuro --ar 4:5 --stylize 200' },
    ]);
  });

  test('preserves order across a mixed content array', () => {
    const assets = extractAssets([
      { type: 'text', text: 'here is your image' },
      { type: 'image', source: { type: 'base64', data: 'AA==', media_type: 'image/jpeg' } },
    ]);
    expect(assets.map((a) => a.kind)).toEqual(['text', 'image']);
  });
});

describe('unmaskError', () => {
  test('flags model_request_failed_error as the masked-schema class and preserves its message', () => {
    const u = unmaskError({
      type: 'session.error',
      error: {
        type: 'model_request_failed_error',
        message: 'tools.0.input_schema: invalid_request_error',
        retry_status: { type: 'terminal' },
      },
    });
    expect(u.isMaskedModelRequestFailure).toBe(true);
    expect(u.isMcpAuthFailure).toBe(false);
    expect(u.message).toBe('tools.0.input_schema: invalid_request_error');
    expect(u.type).toBe('model_request_failed_error');
  });

  test('flags MCP authentication failures and keeps the server name', () => {
    const u = unmaskError({
      type: 'session.error',
      error: {
        type: 'mcp_authentication_failed_error',
        message: 'invalid token',
        mcp_server_name: 'limner',
        retry_status: { type: 'terminal' },
      },
    });
    expect(u.isMcpAuthFailure).toBe(true);
    expect(u.isMaskedModelRequestFailure).toBe(false);
    expect(u.mcpServerName).toBe('limner');
  });

  test('a generic unknown_error is neither a masked-schema nor an MCP-auth failure', () => {
    const u = unmaskError({
      type: 'session.error',
      error: { type: 'unknown_error', message: 'boom', retry_status: { type: 'retrying' } },
    });
    expect(u.isMaskedModelRequestFailure).toBe(false);
    expect(u.isMcpAuthFailure).toBe(false);
    expect(u.message).toBe('boom');
  });
});

describe('reduceEvents', () => {
  test('pairs an MCP tool_use with its tool_result and extracts assets + the derived prompt', () => {
    const t = reduceEvents([
      { type: 'span.model_request_start', id: 's1' },
      { type: 'agent.thinking', id: 'th1' },
      {
        type: 'agent.mcp_tool_use',
        id: 'use1',
        name: 'limner_generate_dalle',
        mcp_server_name: 'limner',
        input: { prompt: 'a Beaux-Arts oil portrait of a figure with...' },
      },
      {
        type: 'agent.mcp_tool_result',
        id: 'res1',
        mcp_tool_use_id: 'use1',
        content: [{ type: 'image', source: { type: 'base64', data: 'SU1H', media_type: 'image/png' } }],
        is_error: false,
      },
      { type: 'agent.message', id: 'm1', content: [{ type: 'text', text: 'Done.' }] },
      { type: 'session.status_idle', id: 'i1', stop_reason: { type: 'end_turn' } },
    ]);

    expect(t.toolCalls).toHaveLength(1);
    expect(t.toolCalls[0].name).toBe('limner_generate_dalle');
    expect(t.toolCalls[0].input).toEqual({ prompt: 'a Beaux-Arts oil portrait of a figure with...' });
    expect(t.toolCalls[0].assets).toEqual([
      { kind: 'image', base64: 'SU1H', mediaType: 'image/png', ext: 'png' },
    ]);
    expect(t.thinkingCount).toBe(1);
    expect(t.modelRequests).toBe(1);
    expect(t.finalText).toBe('Done.');
    expect(t.idleStopReason).toBe('end_turn');
    expect(t.terminated).toBe(false);
    expect(t.errors).toHaveLength(0);
  });

  test('records a session.error (unmasked) and a terminated session', () => {
    const t = reduceEvents([
      {
        type: 'session.error',
        id: 'e1',
        error: { type: 'model_request_failed_error', message: 'schema rejected', retry_status: { type: 'terminal' } },
      },
      { type: 'session.status_terminated', id: 'term1' },
    ]);
    expect(t.errors).toHaveLength(1);
    expect(t.errors[0].isMaskedModelRequestFailure).toBe(true);
    expect(t.terminated).toBe(true);
  });

  test('joins multiple agent.message blocks into finalText', () => {
    const t = reduceEvents([
      { type: 'agent.message', id: 'm1', content: [{ type: 'text', text: 'For print:' }] },
      { type: 'agent.message', id: 'm2', content: [{ type: 'text', text: 'use TIFF.' }] },
    ]);
    expect(t.finalText).toContain('For print:');
    expect(t.finalText).toContain('use TIFF.');
  });
});

describe('fileTypesSkillSignal', () => {
  test('true when the answer distinguishes print formats from web formats', () => {
    const text =
      'For fine-art print, deliver a TIFF or PDF with a CMYK profile at 300 DPI. ' +
      'For web display, use WebP or PNG (RGB) for smaller files.';
    expect(fileTypesSkillSignal(text)).toBe(true);
  });

  test('false for a generic answer that names no formats', () => {
    expect(fileTypesSkillSignal('It depends on your use case; pick whatever looks best.')).toBe(false);
  });
});

describe('evaluateTask', () => {
  const genSpec: TaskSpec = {
    id: 'portrait-dalle',
    stage: 2,
    kind: 'generate',
    expectedTool: 'limner_generate_dalle',
    assetKind: 'image',
    attachImage: true,
    prompt: 'x',
  };

  test('a healthy generate transcript passes every criterion', () => {
    const t = reduceEvents([
      {
        type: 'agent.mcp_tool_use',
        id: 'u1',
        name: 'limner_generate_dalle',
        mcp_server_name: 'limner',
        input: { prompt: 'a Beaux-Arts oil portrait with described features' },
      },
      {
        type: 'agent.mcp_tool_result',
        id: 'r1',
        mcp_tool_use_id: 'u1',
        content: [{ type: 'image', source: { type: 'base64', data: 'SU1H', media_type: 'image/png' } }],
      },
      { type: 'session.status_idle', id: 'i1', stop_reason: { type: 'end_turn' } },
    ]);
    const res = evaluateTask(t, genSpec);
    expect(res.pass).toBe(true);
    expect(res.criteria.find((c) => c.name === 'schemasAccepted')?.pass).toBe(true);
    expect(res.criteria.find((c) => c.name === 'mcpToolsReached')?.pass).toBe(true);
    expect(res.criteria.find((c) => c.name === 'toolSelectionAppropriate')?.pass).toBe(true);
    expect(res.criteria.find((c) => c.name === 'visionDerivedPrompt')?.pass).toBe(true);
    expect(res.criteria.find((c) => c.name === 'assetProduced')?.pass).toBe(true);
  });

  test('matches a CMA bare tool name (limner_ prefix stripped) against the registered expectedTool', () => {
    // The live run revealed CMA exposes the tool to the model as
    // `generate_midjourney` (server `limner`), not `limner_generate_midjourney`.
    const t = reduceEvents([
      {
        type: 'agent.mcp_tool_use',
        id: 'u1',
        name: 'generate_midjourney',
        mcp_server_name: 'limner',
        input: { prompt: 'a Beaux-Arts oil portrait in strict profile with described features' },
      },
      {
        type: 'agent.mcp_tool_result',
        id: 'r1',
        mcp_tool_use_id: 'u1',
        content: [{ type: 'text', text: '{"pipeline":"midjourney"}' }],
      },
      { type: 'session.status_idle', id: 'i1', stop_reason: { type: 'end_turn' } },
    ]);
    const spec: TaskSpec = {
      id: 'portrait-midjourney',
      stage: 1,
      kind: 'generate',
      expectedTool: 'limner_generate_midjourney',
      assetKind: 'prompt',
      attachImage: true,
      prompt: 'x',
    };
    const res = evaluateTask(t, spec);
    expect(res.criteria.find((c) => c.name === 'toolSelectionAppropriate')?.pass).toBe(true);
    expect(res.criteria.find((c) => c.name === 'visionDerivedPrompt')?.pass).toBe(true);
    expect(res.pass).toBe(true);
  });

  test('normalizeToolName strips a leading limner_ so registered and observed names compare equal', () => {
    expect(normalizeToolName('limner_generate_midjourney')).toBe('generate_midjourney');
    expect(normalizeToolName('generate_midjourney')).toBe('generate_midjourney');
    expect(normalizeToolName('limner_compose')).toBe('compose');
  });

  test('a masked model_request_failed_error fails schemasAccepted and the task overall', () => {
    const t = reduceEvents([
      {
        type: 'session.error',
        id: 'e1',
        error: { type: 'model_request_failed_error', message: 'schema rejected', retry_status: { type: 'terminal' } },
      },
      { type: 'session.status_terminated', id: 'x' },
    ]);
    const res = evaluateTask(t, genSpec);
    expect(res.criteria.find((c) => c.name === 'schemasAccepted')?.pass).toBe(false);
    expect(res.pass).toBe(false);
  });

  test('no tool calls fails mcpToolsReached', () => {
    const t = reduceEvents([
      { type: 'agent.message', id: 'm1', content: [{ type: 'text', text: 'I cannot reach the tools.' }] },
      { type: 'session.status_idle', id: 'i1', stop_reason: { type: 'end_turn' } },
    ]);
    const res = evaluateTask(t, genSpec);
    expect(res.criteria.find((c) => c.name === 'mcpToolsReached')?.pass).toBe(false);
    expect(res.pass).toBe(false);
  });

  test('an advice task passes when the file-types skill signal is present', () => {
    const adviceSpec: TaskSpec = {
      id: 'format-advice',
      stage: 1,
      kind: 'advice',
      attachImage: false,
      prompt: 'x',
    };
    const t = reduceEvents([
      {
        type: 'agent.message',
        id: 'm1',
        content: [
          {
            type: 'text',
            text: 'Print: TIFF/PDF, CMYK, 300 DPI. Web: WebP or PNG in RGB.',
          },
        ],
      },
      { type: 'session.status_idle', id: 'i1', stop_reason: { type: 'end_turn' } },
    ]);
    const res = evaluateTask(t, adviceSpec);
    expect(res.criteria.find((c) => c.name === 'fileTypesSkillUsed')?.pass).toBe(true);
    expect(res.pass).toBe(true);
  });
});

describe('summarizeAssetForArtifact', () => {
  test('an image asset is summarized WITHOUT its base64 bytes', () => {
    const summary = summarizeAssetForArtifact(
      { kind: 'image', base64: 'SU1HUNJTREVD', mediaType: 'image/png', ext: 'png' },
      'portrait-dalle-1.png',
    );
    expect(summary).toEqual({
      kind: 'image',
      mediaType: 'image/png',
      ext: 'png',
      bytes: 9,
      savedAs: 'portrait-dalle-1.png',
    });
    // The base64 payload must never appear in the artifact.
    expect(JSON.stringify(summary)).not.toContain('SU1HUNJTREVD');
  });

  test('url and text assets pass through verbatim', () => {
    expect(summarizeAssetForArtifact({ kind: 'url', url: 'https://x/y.png' })).toEqual({
      kind: 'url',
      url: 'https://x/y.png',
    });
    expect(summarizeAssetForArtifact({ kind: 'text', text: 'a prompt' })).toEqual({
      kind: 'text',
      text: 'a prompt',
    });
  });
});

describe('task specs', () => {
  test('Stage 1 covers the Midjourney portrait and the format-advice task', () => {
    const ids = STAGE1_TASKS.map((t) => t.id);
    expect(ids).toContain('portrait-midjourney');
    expect(ids).toContain('format-advice');
    const mj = STAGE1_TASKS.find((t) => t.id === 'portrait-midjourney')!;
    expect(mj.expectedTool).toBe('limner_generate_midjourney');
    expect(mj.attachImage).toBe(true);
    const advice = STAGE1_TASKS.find((t) => t.id === 'format-advice')!;
    expect(advice.kind).toBe('advice');
    expect(advice.attachImage).toBe(false);
  });

  test('Stage 2 covers the DALL·E and Recraft portrait renditions', () => {
    const tools = STAGE2_TASKS.map((t) => t.expectedTool);
    expect(tools).toContain('limner_generate_dalle');
    expect(tools).toContain('limner_generate_recraft');
  });

  test('agent-facing prompts carry the A4 third-party framing and the Beaux-Arts brief', () => {
    expect(A4_PREAMBLE.toLowerCase()).toContain('third-party');
    const mj = STAGE1_TASKS.find((t) => t.id === 'portrait-midjourney')!;
    expect(mj.prompt.toLowerCase()).toContain('beaux-arts');
    expect(mj.prompt).toContain(A4_PREAMBLE);
  });
});

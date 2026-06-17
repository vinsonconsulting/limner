import { describe, expect, test, vi } from 'vitest';

import {
  PipelineError,
  RecraftPipeline,
  type PipelineContext,
  type PipelineImageOutput,
  type RecraftGenerateArgs,
  type RecraftGenerateResult,
  type RecraftTransport,
} from '../../src/index.js';

function fakeTransport(result: RecraftGenerateResult): {
  transport: RecraftTransport;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn().mockResolvedValue(result);
  return {
    transport: { generateImage: spy as (args: RecraftGenerateArgs) => Promise<RecraftGenerateResult> },
    spy,
  };
}

function failingTransport(err: unknown): RecraftTransport {
  return { generateImage: vi.fn().mockRejectedValue(err) };
}

const CTX: PipelineContext = { secrets: { RECRAFT_API_KEY: 'rk-test-789' } };
const NO_KEY_CTX: PipelineContext = { secrets: {} };

describe('RecraftPipeline — metadata', () => {
  test('id, kind, requiredSecrets', () => {
    const p = new RecraftPipeline();
    expect(p.id).toBe('recraft');
    // D-RA-25: Recraft is a direct REST pipeline now, same kind as dalle.
    expect(p.kind).toBe('api');
    expect(p.requiredSecrets).toEqual(['RECRAFT_API_KEY']);
  });
});

describe('RecraftPipeline — happy path', () => {
  test('passes args through and returns image with url', async () => {
    const { transport, spy } = fakeTransport({
      url: 'https://cdn.recraft.ai/abc.png',
      mimeType: 'image/png',
    });
    const p = new RecraftPipeline(transport);
    const out = (await p.generate(
      {
        prompt: 'logo for a coffee brand',
        options: { style: 'vector_illustration', substyle: 'flat', model: 'recraftv3' },
      },
      CTX,
    )) as PipelineImageOutput;

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]![0]).toEqual({
      prompt: 'logo for a coffee brand',
      size: '1024x1024',
      style: 'vector_illustration',
      substyle: 'flat',
      model: 'recraftv3',
    });

    expect(out.url).toBe('https://cdn.recraft.ai/abc.png');
    expect(out.mimeType).toBe('image/png');
    expect(out.width).toBe(1024);
    expect(out.height).toBe(1024);
    expect(out.metadata).toMatchObject({
      pipeline: 'recraft',
      style: 'vector_illustration',
      substyle: 'flat',
      model: 'recraftv3',
      size: '1024x1024',
    });
  });

  // r3: result.raw (the full upstream response, which can include the base64
  // image) must NOT enter pipeline metadata — the MCP tool layer spreads
  // metadata into structuredContent verbatim, so the bytes would ship twice.
  test('transport raw response is never copied into metadata', async () => {
    const { transport } = fakeTransport({
      url: 'https://cdn.recraft.ai/abc.png',
      raw: { content: [{ type: 'image', data: 'aGVhdnliYXNlNjQ=' }] },
    });
    const p = new RecraftPipeline(transport);
    const out = (await p.generate({ prompt: 'cat' }, CTX)) as PipelineImageOutput;
    expect(out.metadata).not.toHaveProperty('raw');
  });

  test('returns image with bytes when transport provides data', async () => {
    const { transport } = fakeTransport({
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      width: 512,
      height: 512,
    });
    const p = new RecraftPipeline(transport);
    const out = (await p.generate({ prompt: 'cat' }, CTX)) as PipelineImageOutput;
    expect(out.url).toBeUndefined();
    expect(out.data).toEqual(new Uint8Array([1, 2, 3]));
    expect(out.width).toBe(512);
  });

  test('non-default size and style propagate', async () => {
    const { transport, spy } = fakeTransport({ url: 'https://x' });
    const p = new RecraftPipeline(transport);
    await p.generate(
      { prompt: 'cat', options: { size: '1365x1024', style: 'digital_illustration' } },
      CTX,
    );
    expect(spy.mock.calls[0]![0]).toMatchObject({
      size: '1365x1024',
      style: 'digital_illustration',
    });
  });
});

describe('RecraftPipeline — missing credential', () => {
  test('without RECRAFT_API_KEY throws missing_credential', async () => {
    const { transport } = fakeTransport({ url: 'https://x' });
    const p = new RecraftPipeline(transport);
    await expect(p.generate({ prompt: 'cat' }, NO_KEY_CTX)).rejects.toMatchObject({
      code: 'missing_credential',
    });
  });
});

describe('RecraftPipeline — invalid input', () => {
  test('empty prompt throws invalid_input', async () => {
    const { transport } = fakeTransport({ url: 'https://x' });
    const p = new RecraftPipeline(transport);
    await expect(p.generate({ prompt: '   ' }, CTX)).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });
});

describe('RecraftPipeline — transport errors', () => {
  test('PipelineError from transport passes through', async () => {
    const upstream = new PipelineError('recraft', 'rate_limited', 'too fast');
    const p = new RecraftPipeline(failingTransport(upstream));
    await expect(p.generate({ prompt: 'cat' }, CTX)).rejects.toBe(upstream);
  });

  test('non-PipelineError wraps as upstream_error', async () => {
    const p = new RecraftPipeline(failingTransport(new Error('boom')));
    await expect(p.generate({ prompt: 'cat' }, CTX)).rejects.toMatchObject({
      pipelineId: 'recraft',
      code: 'upstream_error',
    });
  });

  test('transport returning neither url nor data throws upstream_error', async () => {
    const { transport } = fakeTransport({ mimeType: 'image/png' });
    const p = new RecraftPipeline(transport);
    await expect(p.generate({ prompt: 'cat' }, CTX)).rejects.toMatchObject({
      code: 'upstream_error',
    });
  });
});

describe('RecraftPipeline — default placeholder transport', () => {
  test('throws upstream_unavailable with actionable message', async () => {
    const p = new RecraftPipeline();
    await expect(p.generate({ prompt: 'cat' }, CTX)).rejects.toMatchObject({
      code: 'upstream_unavailable',
    });
    try {
      await p.generate({ prompt: 'cat' }, CTX);
    } catch (err) {
      expect((err as Error).message).toMatch(/RestRecraftTransport|RecraftTransport|inject/i);
    }
  });
});

describe('RecraftPipeline — close()', () => {
  test('close is safe to call when transport has no close method', async () => {
    const { transport } = fakeTransport({ url: 'https://x' });
    const p = new RecraftPipeline(transport);
    await expect(p.close()).resolves.toBeUndefined();
  });

  test('close delegates to transport when implemented', async () => {
    const closeSpy = vi.fn().mockResolvedValue(undefined);
    const transport: RecraftTransport = {
      generateImage: vi.fn().mockResolvedValue({ url: 'https://x' }),
      close: closeSpy,
    };
    const p = new RecraftPipeline(transport);
    await p.close();
    expect(closeSpy).toHaveBeenCalledOnce();
  });
});

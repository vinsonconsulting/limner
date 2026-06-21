import { describe, expect, test, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Bindings } from '@limner/core';
import type { R2Bucket } from '@cloudflare/workers-types';

import { createServer, registerTools, type Tool, type ToolContext } from '../../src/server.js';
import { pipelineTools } from '../../src/tools/pipelines.js';

// Mock fetch for the DALL-E call. The pipeline reads OPENAI_API_KEY
// from ToolContext.secrets and calls https://api.openai.com/v1/images/generations.
function mockFetch(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

// The SSRF guard now resolves source-image hostnames over DoH (1.1.1.1/dns-query)
// before fetching them. Tests that stub global fetch and route a source image
// through a pipeline must answer that lookup with a public IP, or the guard fails
// closed. Returns null for non-DoH URLs so the caller handles them as before.
function dohAnswer(url: string): Response | null {
  if (!url.startsWith('https://1.1.1.1/dns-query')) return null;
  const type = new URL(url).searchParams.get('type');
  return new Response(
    JSON.stringify({ Status: 0, Answer: type === 'A' ? [{ type: 1, data: '203.0.113.10' }] : [] }),
    { status: 200, headers: { 'content-type': 'application/dns-json' } },
  );
}

async function connectedPair(
  tools: readonly Tool[],
  ctx: ToolContext,
): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer('test', '0.0.1');
  registerTools(server, tools, () => ctx);
  const [c, s] = InMemoryTransport.createLinkedPair();
  await server.connect(s);
  const client = new Client({ name: 'test-client', version: '0.0.1' }, { capabilities: {} });
  await client.connect(c);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

const localBindings = { kind: 'local' } as unknown as Bindings;

describe('pipelineTools registry surface', () => {
  test('exposes generate_dalle, generate_midjourney, generate_recraft, upscale, vectorize', () => {
    const names = pipelineTools.map((t) => t.name);
    expect(names).toEqual([
      'limner_generate_dalle',
      'limner_generate_midjourney',
      'limner_generate_recraft',
      'limner_upscale',
      'limner_vectorize',
    ]);
  });
});

describe('limner_generate_midjourney', () => {
  test('returns text content with the composed prompt', async () => {
    const ctx: ToolContext = { bindings: localBindings, secrets: {} };
    const { client, close } = await connectedPair(pipelineTools, ctx);
    try {
      const result = await client.callTool({
        name: 'limner_generate_midjourney',
        arguments: { prompt: 'a serene mountain landscape', aspectRatio: '16:9', stylize: 200 },
      });
      // Midjourney pipeline composes a prompt string and returns it as text.
      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content).toHaveLength(1);
      expect(content[0]!.type).toBe('text');
      expect(content[0]!.text).toContain('a serene mountain landscape');
      expect(content[0]!.text).toContain('--ar 16:9');
      expect(content[0]!.text).toContain('--stylize 200');
    } finally {
      await close();
    }
  });
});

describe('generate_dalle (mocked OpenAI)', () => {
  test('happy path: returns image content (base64) when pipeline yields data', async () => {
    // 1x1 red PNG, base64-encoded.
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ data: [{ b64_json: onePixelPng }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    // Inject the fetch via the DallePipeline constructor. We do that
    // through a custom tool definition that wraps our pipeline tool;
    // pipelineTools.ts uses `new DallePipeline()` with the default fetch,
    // so for this test we re-register a tool with the injected pipeline.
    // (The dispatch contract is identical; we're testing the wiring.)
    const { DallePipeline } = await import('@limner/core');
    const customTool: Tool = {
      name: 'limner_generate_dalle',
      description: 'test override',
      inputSchema: pipelineTools.find((t) => t.name === 'limner_generate_dalle')!.inputSchema,
      handler: async (input, ctx) => {
        const p = new DallePipeline(fetchMock as any);
        const out = await p.generate(
          { prompt: input.prompt as string, options: input },
          { secrets: ctx.secrets },
        );
        if (out.kind !== 'image') throw new Error('expected image');
        const bytes = out.data!;
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
        return {
          content: [{ type: 'image', data: btoa(bin), mimeType: out.mimeType }],
          structuredContent: { pipeline: 'dalle', mimeType: out.mimeType, width: out.width, height: out.height },
        };
      },
    };
    const ctx: ToolContext = {
      bindings: localBindings,
      secrets: { OPENAI_API_KEY: 'sk-test' },
    };
    const { client, close } = await connectedPair([customTool], ctx);
    try {
      const result = await client.callTool({
        name: 'limner_generate_dalle',
        arguments: { prompt: 'a single red apple', size: '1024x1024' },
      });
      const content = result.content as Array<{ type: string; data?: string; mimeType?: string }>;
      expect(content[0]!.type).toBe('image');
      expect(content[0]!.mimeType).toBe('image/png');
      expect(typeof content[0]!.data).toBe('string');
      expect(content[0]!.data!.length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  test('uploads to the delivery store and returns a URL when ctx.delivery is set (PR D)', async () => {
    // 1x1 red PNG. The real generate_dalle handler uses DallePipeline()'s
    // default global fetch, so stub the global to return image bytes; with a
    // delivery store wired, runImagePipeline uploads and returns a URL instead
    // of inline base64 (the gpt-image-1 message-size-ceiling fix).
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: onePixelPng }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const put = vi.fn().mockResolvedValue({ key: 'x' });
    const ctx: ToolContext = {
      bindings: localBindings,
      secrets: { OPENAI_API_KEY: 'sk-test' },
      delivery: { bucket: { put } as unknown as R2Bucket, baseUrl: 'https://assets.example' },
    };
    const { client, close } = await connectedPair(pipelineTools, ctx);
    try {
      const result = await client.callTool({
        name: 'limner_generate_dalle',
        arguments: { prompt: 'a red apple' },
      });
      expect(result.isError).toBeFalsy();
      // Bytes uploaded under generated/dalle/<uuid>.png; nothing inline.
      expect(put).toHaveBeenCalledOnce();
      const key = put.mock.calls[0]![0] as string;
      expect(key).toMatch(/^generated\/dalle\/[0-9a-f-]+\.png$/);
      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0]!.type).toBe('text');
      expect(content[0]!.text).toBe(`https://assets.example/artifact/${key}`);
      const sc = (result as { structuredContent?: Record<string, unknown> }).structuredContent;
      expect(sc?.['url']).toBe(`https://assets.example/artifact/${key}`);
    } finally {
      globalThis.fetch = realFetch;
      await close();
    }
  });

  test('missing OPENAI_API_KEY surfaces as isError=true', async () => {
    const ctx: ToolContext = { bindings: localBindings, secrets: {} };
    const { client, close } = await connectedPair(pipelineTools, ctx);
    try {
      const result = await client.callTool({
        name: 'limner_generate_dalle',
        arguments: { prompt: 'cat' },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/missing required secret/i);
    } finally {
      await close();
    }
  });
});

describe('limner_generate_recraft', () => {
  test('missing RECRAFT_API_KEY surfaces as isError=true', async () => {
    const ctx: ToolContext = { bindings: localBindings, secrets: {} };
    const { client, close } = await connectedPair(pipelineTools, ctx);
    try {
      const result = await client.callTool({
        name: 'limner_generate_recraft',
        arguments: { prompt: 'logo' },
      });
      expect(result.isError).toBe(true);
      // RecraftPipeline.generate() asserts the secret before any REST call.
      expect(JSON.stringify(result.content)).toMatch(/RECRAFT_API_KEY/);
    } finally {
      await close();
    }
  });

  // D-RA-25: direct REST. Stub the global fetch (the prod Worker path) with a
  // Recraft generations response and assert the tool surfaces the hosted URL.
  test('dispatch returns the Recraft url (mocked REST)', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ url: 'https://img.recraft.ai/abc.png' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const ctx: ToolContext = { bindings: localBindings, secrets: { RECRAFT_API_KEY: 'rk-test' } };
    const { client, close } = await connectedPair(pipelineTools, ctx);
    try {
      const result = await client.callTool({
        name: 'limner_generate_recraft',
        arguments: { prompt: 'logo', style: 'vector_illustration' },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ text?: string }>)[0]?.text ?? '';
      expect(text).toBe('https://img.recraft.ai/abc.png');
      expect(
        (result as { structuredContent?: Record<string, unknown> }).structuredContent,
      ).toMatchObject({ pipeline: 'recraft', url: 'https://img.recraft.ai/abc.png' });
    } finally {
      globalThis.fetch = realFetch;
      await close();
    }
  });
});

describe('limner_upscale', () => {
  test('missing RECRAFT_API_KEY surfaces as isError=true', async () => {
    const ctx: ToolContext = { bindings: localBindings, secrets: {} };
    const { client, close } = await connectedPair(pipelineTools, ctx);
    try {
      const result = await client.callTool({
        name: 'limner_upscale',
        arguments: { image: 'https://src.example/x.png' },
      });
      expect(result.isError).toBe(true);
      // assertSecrets runs before any REST call.
      expect(JSON.stringify(result.content)).toMatch(/RECRAFT_API_KEY/);
    } finally {
      await close();
    }
  });

  // The handler fetches the source URL, then POSTs it to /images/crispUpscale.
  // With a delivery store wired, the upscaled bytes re-host to a capability URL.
  test('re-hosts the upscaled bytes to a capability URL when delivery is set', async () => {
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: unknown) => {
      const doh = dohAnswer(String(url));
      if (doh) return doh;
      return String(url).includes('/images/crispUpscale')
        ? new Response(JSON.stringify({ image: { b64_json: onePixelPng } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : new Response(Uint8Array.from(atob(onePixelPng), (c) => c.charCodeAt(0)), {
            status: 200,
            headers: { 'content-type': 'image/png' },
          });
    }) as unknown as typeof fetch;
    const put = vi.fn().mockResolvedValue({ key: 'x' });
    const ctx: ToolContext = {
      bindings: localBindings,
      secrets: { RECRAFT_API_KEY: 'rk-test' },
      delivery: { bucket: { put } as unknown as R2Bucket, baseUrl: 'https://assets.example' },
    };
    const { client, close } = await connectedPair(pipelineTools, ctx);
    try {
      const result = await client.callTool({
        name: 'limner_upscale',
        arguments: { image: 'https://src.example/small.png' },
      });
      expect(result.isError).toBeFalsy();
      expect(put).toHaveBeenCalledOnce();
      const key = put.mock.calls[0]![0] as string;
      expect(key).toMatch(/^generated\/recraft-upscale\/[0-9a-f-]+\.png$/);
      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0]!.type).toBe('text');
      expect(content[0]!.text).toBe(`https://assets.example/artifact/${key}`);
    } finally {
      globalThis.fetch = realFetch;
      await close();
    }
  });
});

describe('limner_vectorize', () => {
  test('missing RECRAFT_API_KEY surfaces as isError=true', async () => {
    const ctx: ToolContext = { bindings: localBindings, secrets: {} };
    const { client, close } = await connectedPair(pipelineTools, ctx);
    try {
      const result = await client.callTool({
        name: 'limner_vectorize',
        arguments: { image: 'https://src.example/x.png' },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/RECRAFT_API_KEY/);
    } finally {
      await close();
    }
  });

  // The handler fetches the source URL, then POSTs it to /images/vectorize.
  // The SVG bytes re-host under an .svg key when a delivery store is wired.
  test('re-hosts the SVG to a capability URL with an .svg key', async () => {
    const svgB64 = btoa('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: unknown) => {
      const doh = dohAnswer(String(url));
      if (doh) return doh;
      return String(url).includes('/images/vectorize')
        ? new Response(JSON.stringify({ image: { b64_json: svgB64 } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'content-type': 'image/png' },
          });
    }) as unknown as typeof fetch;
    const put = vi.fn().mockResolvedValue({ key: 'x' });
    const ctx: ToolContext = {
      bindings: localBindings,
      secrets: { RECRAFT_API_KEY: 'rk-test' },
      delivery: { bucket: { put } as unknown as R2Bucket, baseUrl: 'https://assets.example' },
    };
    const { client, close } = await connectedPair(pipelineTools, ctx);
    try {
      const result = await client.callTool({
        name: 'limner_vectorize',
        arguments: { image: 'https://src.example/logo.png' },
      });
      expect(result.isError).toBeFalsy();
      expect(put).toHaveBeenCalledOnce();
      const key = put.mock.calls[0]![0] as string;
      expect(key).toMatch(/^generated\/recraft-vectorize\/[0-9a-f-]+\.svg$/);
      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0]!.text).toBe(`https://assets.example/artifact/${key}`);
    } finally {
      globalThis.fetch = realFetch;
      await close();
    }
  });
});

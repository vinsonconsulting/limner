import { beforeAll, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Bindings, CFImagesBinding } from '@limner/core';

import { createServer, registerTools, type ToolContext } from '../../src/server.js';
import { composeTool } from '../../src/tools/compose.js';

// jsquash WASM init helper from @limner/core's test tree. compose's
// encode/decode/convert ops route through jsquash-codecs, which needs
// WASM init in Node (Workers handles it via bundler).
import { initJsquashForNode } from '../../../limner-core/test/compose/helpers/jsquash-init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const corefix = (name: string): Uint8Array =>
  new Uint8Array(
    readFileSync(resolve(__dirname, '../../../limner-core/test/compose/fixtures', name)),
  );

beforeAll(async () => {
  await initJsquashForNode();
}, 60_000);

async function connectedPair(
  ctx: ToolContext,
): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer('test', '0.0.1');
  registerTools(server, [composeTool], () => ctx);
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

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decodeImageContent(result: unknown): Uint8Array {
  const r = result as { content: Array<{ type: string; data?: string; mimeType?: string }> };
  const block = r.content[0]!;
  expect(block.type).toBe('image');
  const bin = atob(block.data!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const localCtx: ToolContext = {
  bindings: { kind: 'local' } as unknown as Bindings,
  secrets: {},
};

describe('compose tool — photon ops', () => {
  test('resize: 64x64 checker -> 32x32 PNG', async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const result = await client.callTool({
        name: 'compose',
        arguments: {
          op: 'resize',
          input: b64encode(corefix('checker-64.png')),
          width: 32,
          height: 32,
        },
      });
      const bytes = decodeImageContent(result);
      expect(bytes.slice(0, 8)).toEqual(PNG_MAGIC);
    } finally {
      await close();
    }
  });

  test('crop: returns PNG bytes', async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const result = await client.callTool({
        name: 'compose',
        arguments: {
          op: 'crop',
          input: b64encode(corefix('checker-64.png')),
          x: 0,
          y: 0,
          width: 32,
          height: 32,
        },
      });
      const bytes = decodeImageContent(result);
      expect(bytes.slice(0, 8)).toEqual(PNG_MAGIC);
    } finally {
      await close();
    }
  });

  test('watermark: composites two layers', async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const input = b64encode(corefix('checker-64.png'));
      const result = await client.callTool({
        name: 'compose',
        arguments: { op: 'watermark', base: input, overlay: input, x: 8, y: 8 },
      });
      const bytes = decodeImageContent(result);
      expect(bytes.slice(0, 8)).toEqual(PNG_MAGIC);
    } finally {
      await close();
    }
  });
});

describe('compose tool — jsquash ops', () => {
  test('convert PNG -> JPEG returns JPEG bytes', async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const result = await client.callTool({
        name: 'compose',
        arguments: {
          op: 'convert',
          input: b64encode(corefix('checker-64.png')),
          from: 'png',
          to: 'jpeg',
          quality: 80,
        },
      });
      const bytes = decodeImageContent(result);
      // JPEG magic: FF D8 FF
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes[2]).toBe(0xff);
    } finally {
      await close();
    }
  });

  test('decode returns structured content with width/height/raw', async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const result = await client.callTool({
        name: 'compose',
        arguments: { op: 'decode', input: b64encode(corefix('checker-64.png')), format: 'png' },
      });
      const r = result as { content: Array<{ type: string; text?: string }> };
      expect(r.content[0]!.type).toBe('text');
      const parsed = JSON.parse(r.content[0]!.text!);
      expect(parsed.width).toBe(64);
      expect(parsed.height).toBe(64);
      expect(typeof parsed.rawBase64).toBe('string');
    } finally {
      await close();
    }
  });
});

describe('compose tool — cf-images ops (stdio: unsupported)', () => {
  test('cfTransform without images binding -> isError + clear message', async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const result = await client.callTool({
        name: 'compose',
        arguments: { op: 'cfTransform', input: b64encode(corefix('checker-64.png')), opts: { blur: 5 } },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/unsupported_in_stdio/);
    } finally {
      await close();
    }
  });
});

describe('compose tool — cf-images ops (workers: with mock binding)', () => {
  test('cfBlur forwards opts to the binding', async () => {
    const output = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }));
    const transform = vi.fn().mockReturnValue({ output });
    const inputFn = vi.fn().mockReturnValue({ transform });
    const mockBinding = { input: inputFn } as unknown as CFImagesBinding;

    const workersCtx: ToolContext = {
      bindings: { kind: 'workers' } as unknown as Bindings,
      images: mockBinding,
      secrets: {},
    };
    const { client, close } = await connectedPair(workersCtx);
    try {
      const result = await client.callTool({
        name: 'compose',
        arguments: {
          op: 'cfBlur',
          input: b64encode(new Uint8Array([99])),
          radius: 25,
        },
      });
      expect(result.isError).toBeFalsy();
      // The mock binding chain was called with opts.blur=25.
      expect(transform).toHaveBeenCalledWith({ blur: 25 });
    } finally {
      await close();
    }
  });
});

describe('compose tool — schema validation', () => {
  test('unknown op -> isError', async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const result = await client.callTool({
        name: 'compose',
        arguments: { op: 'no_such_op' },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/invalid arguments/);
    } finally {
      await close();
    }
  });

  test('resize missing required field (width) -> isError', async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const result = await client.callTool({
        name: 'compose',
        arguments: { op: 'resize', input: 'abc', height: 32 },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });
});

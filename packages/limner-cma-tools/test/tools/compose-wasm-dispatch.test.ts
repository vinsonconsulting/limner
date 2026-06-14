// Both-paths regression guard for the compose WASM-init gap.
//
// Before the fix, Path A (cma-tools dispatch) never initialized WASM —
// it owns no entry point — so the first renderText/codec op threw, while
// the suite stayed green because the other compose tests init the WASM
// out-of-band via the limner-core test helpers.
//
// This file deliberately uses NO test helper and does NOT call
// ensureComposeWasm / initComposeWasmNode. It only REGISTERS a Node
// module provider with @limner/core (acquire-only). WASM therefore
// initializes ONLY if the compose ops self-init on first use via core's
// lazy ensureComposeWasm. Comment those `await ensureComposeWasm()`
// lines out in @limner/core and both describes below go red — that is
// the regression this guard catches, on both dispatch paths.
//
// vitest isolates module registries per file, so core starts here with a
// fresh, un-inited compose-wasm state; the first op triggers the ensure.

import { beforeAll, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { R2Bucket } from '@cloudflare/workers-types';

import { registerComposeWasmProvider, type Bindings } from '@limner/core';
import { acquireComposeWasmModulesNode } from '@limner/mcp/wasm-init-node';
import {
  composeTool as mcpComposeTool,
  createServer,
  registerTools,
  type ToolContext,
} from '@limner/mcp';

import { composeTool as cmaComposeTool } from '../../src/tools/compose.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = resolve(__dirname, '../../../limner-core/assets/fonts/IBMPlexSans-Regular.ttf');
const FIXTURE_PATH = resolve(__dirname, '../../../limner-core/test/compose/fixtures/checker-64.png');

const FONT_BYTES = new Uint8Array(readFileSync(FONT_PATH));
const PNG_FIXTURE = new Uint8Array(readFileSync(FIXTURE_PATH));

// Acquire-only: register the Node provider but never call ensureComposeWasm.
// The ops must self-init for these tests to pass.
beforeAll(() => {
  registerComposeWasmProvider(acquireComposeWasmModulesNode);
});

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function mockBucket(): { bucket: R2Bucket; put: ReturnType<typeof vi.fn> } {
  const put = vi.fn().mockResolvedValue({ key: 'x', etag: 'y' });
  return { bucket: { put } as unknown as R2Bucket, put };
}

const RENDER_TEXT_JSX = {
  type: 'div',
  props: {
    style: {
      display: 'flex',
      width: '100%',
      height: '100%',
      fontSize: 24,
      color: '#111',
      background: '#fff',
    },
    children: 'Hello, Limner',
  },
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function expectPngMagic(bytes: Uint8Array): void {
  expect([...bytes.slice(0, 4)]).toEqual(PNG_MAGIC);
}

function expectJpegMagic(bytes: Uint8Array): void {
  // JPEG magic: FF D8 FF
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
  expect(bytes[2]).toBe(0xff);
}

// ---- Path B: mcp dispatch through an in-memory MCP server ----

function decodeImageContent(result: unknown): Uint8Array {
  const r = result as { content: Array<{ type: string; data?: string }> };
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

async function connectedPair(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer('test', '0.0.1');
  registerTools(server, [mcpComposeTool], () => localCtx);
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

describe('Path B (mcp dispatch) self-inits via core lazy-ensure', () => {
  test('renderText produces a PNG (resvg)', { timeout: 30_000 }, async () => {
    const { client, close } = await connectedPair();
    try {
      const result = await client.callTool({
        name: 'limner_compose',
        arguments: {
          op: 'renderText',
          jsx: RENDER_TEXT_JSX,
          width: 200,
          height: 80,
          fonts: [{ name: 'IBM Plex Sans', data: b64encode(FONT_BYTES) }],
        },
      });
      expect(result.isError).toBeFalsy();
      expectPngMagic(decodeImageContent(result));
    } finally {
      await close();
    }
  });

  test('convert PNG -> JPEG (jsquash codec)', { timeout: 30_000 }, async () => {
    const { client, close } = await connectedPair();
    try {
      const result = await client.callTool({
        name: 'limner_compose',
        arguments: {
          op: 'convert',
          input: b64encode(PNG_FIXTURE),
          from: 'png',
          to: 'jpeg',
          quality: 80,
        },
      });
      expect(result.isError).toBeFalsy();
      expectJpegMagic(decodeImageContent(result));
    } finally {
      await close();
    }
  });
});

// ---- Path A: cma-tools dispatch through composeTool.run + fake R2 ----

describe('Path A (cma-tools dispatch) self-inits via core lazy-ensure', () => {
  test('renderText uploads a PNG under compose-renderText/ (resvg)', { timeout: 30_000 }, async () => {
    const { bucket, put } = mockBucket();
    const out = await cmaComposeTool.run(
      {
        op: 'renderText',
        jsx: RENDER_TEXT_JSX,
        width: 200,
        height: 80,
        fonts: [{ name: 'IBM Plex Sans', data: b64encode(FONT_BYTES) }],
      },
      { env: { BUCKET: bucket } },
    );

    const envelope = JSON.parse(out) as { url: string; mimeType: string; op: string };
    expect(envelope.url).toMatch(/^r2:\/\/compose-renderText\/[a-f0-9-]+\.png$/);
    expect(envelope.mimeType).toBe('image/png');
    expect(envelope.op).toBe('renderText');

    expect(put).toHaveBeenCalledOnce();
    const [, body] = put.mock.calls[0]!;
    expectPngMagic(body as Uint8Array);
  });

  test('convert uploads image/jpeg under compose-convert/ (jsquash codec)', { timeout: 30_000 }, async () => {
    const { bucket, put } = mockBucket();
    const out = await cmaComposeTool.run(
      { op: 'convert', input: b64encode(PNG_FIXTURE), from: 'png', to: 'jpeg', quality: 80 },
      { env: { BUCKET: bucket } },
    );

    const envelope = JSON.parse(out) as { url: string; mimeType: string; op: string; from: string; to: string };
    expect(envelope.url).toMatch(/^r2:\/\/compose-convert\/[a-f0-9-]+\.jpg$/);
    expect(envelope.mimeType).toBe('image/jpeg');
    expect(envelope.op).toBe('convert');

    const [, body] = put.mock.calls[0]!;
    expectJpegMagic(body as Uint8Array);
  });
});

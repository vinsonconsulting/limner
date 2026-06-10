// Review r1 regression guard: limner_compose's WASM-backed ops must work
// through the PRODUCTION Node init path (src/wasm-init-node.ts — the same
// module stdio.ts awaits at boot).
//
// Deliberately does NOT import the test helpers
// (limner-core/test/compose/helpers/{satori-init,jsquash-init}.ts). Before
// r1, those helpers were the ONLY callers of the codec init functions, so
// the suite was green while every transport was broken — renderText threw
// on first invocation and the jsquash lazy init died on fetch(file://...).
// Vitest isolates module registries per test file and no vitest config
// declares setupFiles, so a green run here proves the production path.

import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Bindings } from '@limner/core';

import { createServer, registerTools, type ToolContext } from '../src/server.js';
import { composeTool } from '../src/tools/compose.js';
import { initComposeWasmNode } from '../src/wasm-init-node.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FONT_PATH = resolve(
  __dirname,
  '../../limner-core/assets/fonts/IBMPlexSans-Regular.ttf',
);
const FIXTURE_PATH = resolve(
  __dirname,
  '../../limner-core/test/compose/fixtures/checker-64.png',
);

// AVIF encode is the slow compile; give the production init headroom.
beforeAll(async () => {
  await initComposeWasmNode();
}, 60_000);

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function decodeImageContent(result: unknown): Uint8Array {
  const r = result as { content: Array<{ type: string; data?: string }> };
  const block = r.content[0]!;
  expect(block.type).toBe('image');
  const bin = atob(block.data!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

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

const localCtx: ToolContext = {
  bindings: { kind: 'local' } as unknown as Bindings,
  secrets: {},
};

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('compose WASM ops via the production node init path (no test helpers)', () => {
  test('renderText produces a PNG', { timeout: 30_000 }, async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const result = await client.callTool({
        name: 'limner_compose',
        arguments: {
          op: 'renderText',
          jsx: {
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
          },
          width: 200,
          height: 80,
          // Font loading is not the thing under test; the init path is.
          fonts: [{ name: 'IBM Plex Sans', data: b64encode(new Uint8Array(readFileSync(FONT_PATH))) }],
        },
      });
      expect(result.isError).toBeFalsy();
      const bytes = decodeImageContent(result);
      expect(bytes.slice(0, 8)).toEqual(PNG_MAGIC);
    } finally {
      await close();
    }
  });

  test('convert PNG -> JPEG works (jsquash codec init)', { timeout: 30_000 }, async () => {
    const { client, close } = await connectedPair(localCtx);
    try {
      const result = await client.callTool({
        name: 'limner_compose',
        arguments: {
          op: 'convert',
          input: b64encode(new Uint8Array(readFileSync(FIXTURE_PATH))),
          from: 'png',
          to: 'jpeg',
          quality: 80,
        },
      });
      expect(result.isError).toBeFalsy();
      const bytes = decodeImageContent(result);
      // JPEG magic: FF D8 FF
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes[2]).toBe(0xff);
    } finally {
      await close();
    }
  });

  test('init is memoized (second await is a no-op)', async () => {
    const first = initComposeWasmNode();
    const second = initComposeWasmNode();
    expect(second).toBe(first);
    await second;
  });
});

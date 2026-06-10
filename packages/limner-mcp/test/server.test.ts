import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Bindings } from '@limner/core';

import {
  createServer,
  registerTools,
  toMcpInputSchema,
  type Tool,
  type ToolContext,
} from '../src/server.js';

/**
 * Spin up an in-process server + client pair via InMemoryTransport so we
 * exercise the real MCP wire protocol without going over a socket.
 * Returns the connected Client and a teardown function.
 */
async function connectedPair(
  tools: readonly Tool[],
  ctxFactory: () => ToolContext = () =>
    ({
      bindings: { kind: 'local' } as unknown as Bindings,
      secrets: {},
    }),
): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer('test-server', '0.0.1');
  registerTools(server, tools, ctxFactory);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '0.0.1' }, { capabilities: {} });
  await client.connect(clientTransport);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe('mcp server: tools/list', () => {
  test('lists registered tools with name, description, and JSON-Schema input', async () => {
    const echo: Tool = {
      name: 'echo',
      description: 'Echo the input message back as text content.',
      inputSchema: z.object({ msg: z.string() }),
      handler: async ({ msg }) => ({ content: [{ type: 'text', text: msg as string }] }),
    };
    const { client, close } = await connectedPair([echo]);
    try {
      const result = await client.listTools();
      expect(result.tools).toHaveLength(1);
      const tool = result.tools[0]!;
      expect(tool.name).toBe('echo');
      expect(tool.description).toBe('Echo the input message back as text content.');
      // zod-to-json-schema emits a JSON Schema 7 object with `type: 'object'`
      // and `properties.msg` for our zod input.
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        properties: { msg: { type: 'string' } },
      });
    } finally {
      await close();
    }
  });
});

describe('mcp server: tools/call dispatch', () => {
  test('routes by name, validates args, returns handler CallToolResult', async () => {
    const handler = vi.fn(async ({ a, b }: { a: number; b: number }) => ({
      content: [{ type: 'text' as const, text: String(a + b) }],
    }));
    const add: Tool = {
      name: 'add',
      description: 'Add two numbers.',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      handler,
    };
    const { client, close } = await connectedPair([add]);
    try {
      const result = await client.callTool({ name: 'add', arguments: { a: 2, b: 3 } });
      expect(result.content).toEqual([{ type: 'text', text: '5' }]);
      expect(handler).toHaveBeenCalledExactlyOnceWith({ a: 2, b: 3 }, expect.any(Object));
    } finally {
      await close();
    }
  });

  test('unknown tool returns isError=true with a clear message', async () => {
    const { client, close } = await connectedPair([]);
    try {
      const result = await client.callTool({ name: 'nope', arguments: {} });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/tool not found: nope/);
    } finally {
      await close();
    }
  });

  test('invalid arguments return isError=true with the zod failure', async () => {
    const t: Tool = {
      name: 'strict',
      description: 'Strict typing.',
      inputSchema: z.object({ n: z.number().int() }),
      handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    };
    const { client, close } = await connectedPair([t]);
    try {
      const result = await client.callTool({ name: 'strict', arguments: { n: 'not a number' } });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/invalid arguments/);
    } finally {
      await close();
    }
  });

  test('handler errors surface as isError=true responses (not transport errors)', async () => {
    const t: Tool = {
      name: 'boom',
      description: 'Always throws.',
      inputSchema: z.object({}),
      handler: async () => {
        throw new Error('intentional');
      },
    };
    const { client, close } = await connectedPair([t]);
    try {
      const result = await client.callTool({ name: 'boom', arguments: {} });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/boom failed: intentional/);
    } finally {
      await close();
    }
  });
});

describe('mcp server: ToolContext factory', () => {
  test('ctxFactory called once per tools/call, not once per server lifetime', async () => {
    const factory = vi.fn(
      (): ToolContext => ({
        bindings: { kind: 'local' } as unknown as Bindings,
        secrets: {},
      }),
    );
    const t: Tool = {
      name: 'ctx',
      description: 'ctx probe',
      inputSchema: z.object({}),
      handler: async (_, ctx) => ({
        content: [{ type: 'text', text: ctx.bindings.kind }],
      }),
    };
    const { client, close } = await connectedPair([t], factory);
    try {
      await client.callTool({ name: 'ctx', arguments: {} });
      await client.callTool({ name: 'ctx', arguments: {} });
      expect(factory).toHaveBeenCalledTimes(2);
    } finally {
      await close();
    }
  });
});

// r4: pin toMcpInputSchema's union-flattening semantics with a synthetic
// discriminated union. These document EXISTING behavior (first-wins on
// colliding property names, discriminator hardcoded to type:"string",
// required = intersection) — they are characterization tests, not a spec
// for new behavior. Tested through the exported toMcpInputSchema rather
// than exporting the private flattenUnionVariants helper, because this is
// the contract tools/list actually uses.
describe('toMcpInputSchema: discriminated-union flattening (r4)', () => {
  const synthetic = z.discriminatedUnion('op', [
    z.object({ op: z.literal('alpha'), x: z.string(), shared: z.string() }),
    z.object({ op: z.literal('beta'), x: z.number(), y: z.number(), shared: z.string() }),
  ]);
  const flat = toMcpInputSchema(synthetic) as {
    type?: string;
    properties?: Record<string, { type?: string; enum?: unknown[] }>;
    required?: string[];
    additionalProperties?: boolean;
    anyOf?: unknown;
    oneOf?: unknown;
    allOf?: unknown;
  };

  test('emits a flat object schema with no top-level combinator', () => {
    expect(flat.type).toBe('object');
    expect(flat.anyOf).toBeUndefined();
    expect(flat.oneOf).toBeUndefined();
    expect(flat.allOf).toBeUndefined();
    expect(flat.additionalProperties).toBe(false);
  });

  test('collapses the discriminator to a string enum over every variant literal', () => {
    // The type is hardcoded "string" regardless of the variants' literal
    // types — documented existing behavior (all current discriminators
    // are string literals).
    expect(flat.properties?.['op']).toEqual({ type: 'string', enum: ['alpha', 'beta'] });
  });

  test('first variant wins on colliding non-discriminator property names', () => {
    // `x` is string in alpha (first) and number in beta — alpha wins.
    expect(flat.properties?.['x']?.type).toBe('string');
  });

  test('property keys are the union of all variant keys', () => {
    expect(Object.keys(flat.properties ?? {}).sort()).toEqual(['op', 'shared', 'x', 'y']);
  });

  test('required is the intersection of the variants\' required sets', () => {
    // alpha requires [op, x, shared]; beta requires [op, x, y, shared];
    // `y` drops out of the advertised required set.
    expect([...(flat.required ?? [])].sort()).toEqual(['op', 'shared', 'x']);
  });

  test('non-union object schemas pass through unchanged', () => {
    const out = toMcpInputSchema(z.object({ a: z.string() })) as {
      type?: string;
      properties?: Record<string, unknown>;
    };
    expect(out.type).toBe('object');
    expect(Object.keys(out.properties ?? {})).toEqual(['a']);
  });
});

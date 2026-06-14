import { describe, expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getGuidance, serializeGuidance } from '@limner/core';

import { createServer } from '../src/server.js';
import { prompts, registerPrompts } from '../src/prompts/index.js';

// In-process server + client over InMemoryTransport, registering only the
// prompts surface. The `prompts` capability comes from createServer.
async function connected(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer('test-server', '0.0.1');
  registerPrompts(server, prompts);

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

describe('mcp server: prompts', () => {
  test('prompts/list advertises capability-tour with the focus argument', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.listPrompts();
      expect(result.prompts).toHaveLength(1);
      const p = result.prompts[0]!;
      expect(p.name).toBe('capability-tour');
      expect(p.arguments).toEqual([
        { name: 'focus', description: expect.any(String), required: false },
      ]);
    } finally {
      await close();
    }
  });

  test('prompts/get returns the capabilities-overview-derived message', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({ name: 'capability-tour' });
      expect(result.messages).toHaveLength(1);
      const m = result.messages[0]!;
      expect(m.role).toBe('user');
      // Byte-identical to the @limner/core serializer over the same entry.
      expect(m.content).toEqual({
        type: 'text',
        text: serializeGuidance(getGuidance('capabilities-overview')!),
      });
    } finally {
      await close();
    }
  });

  test('prompts/get threads the focus argument into the message', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'capability-tour',
        arguments: { focus: 'compose' },
      });
      const m = result.messages[0]!;
      expect(m.content.type).toBe('text');
      expect((m.content as { text: string }).text).toContain('Focus requested: compose');
    } finally {
      await close();
    }
  });

  test('prompts/get rejects an unknown prompt', async () => {
    const { client, close } = await connected();
    try {
      await expect(client.getPrompt({ name: 'does-not-exist' })).rejects.toThrow();
    } finally {
      await close();
    }
  });
});

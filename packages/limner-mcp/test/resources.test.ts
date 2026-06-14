import { describe, expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getGuidance, serializeGuidance } from '@limner/core';

import { createServer } from '../src/server.js';
import { resources, registerResources } from '../src/resources/index.js';

// In-process server + client over InMemoryTransport, registering only the
// resources surface. The `resources` capability comes from createServer, so
// the client permits resources/* (assertCapabilityForMethod).
async function connected(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer('test-server', '0.0.1');
  registerResources(server, resources);

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

describe('mcp server: resources', () => {
  test('resources/list advertises the file-types reference', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.listResources();
      expect(result.resources).toHaveLength(1);
      const r = result.resources[0]!;
      expect(r.uri).toBe('limner://reference/file-types');
      expect(r.name).toBe('file-types');
      expect(r.mimeType).toBe('text/markdown');
    } finally {
      await close();
    }
  });

  test('resources/read returns guidance-derived content (single-source dispatch)', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.readResource({ uri: 'limner://reference/file-types' });
      expect(result.contents).toHaveLength(1);
      const c = result.contents[0]!;
      expect(c.uri).toBe('limner://reference/file-types');
      expect(c.mimeType).toBe('text/markdown');
      // Byte-identical to the @limner/core serializer over the same entry —
      // proves the read dispatches through guidance, not a hardcoded copy.
      expect(c.text).toBe(serializeGuidance(getGuidance('file-types')!));
    } finally {
      await close();
    }
  });

  test('resources/read rejects an unknown uri', async () => {
    const { client, close } = await connected();
    try {
      await expect(client.readResource({ uri: 'limner://nope' })).rejects.toThrow();
    } finally {
      await close();
    }
  });
});

import { describe, expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/server.js';
import { resources, registerResources } from '../src/resources/index.js';
import { prompts, registerPrompts } from '../src/prompts/index.js';

// Capability handshake (D-RA-24). Asserts the server now advertises prompts +
// resources alongside tools on initialize — the widened capability set the v1
// test sequence (Inspector -> MCPJam -> ...) must now cover.
describe('mcp server: capability handshake', () => {
  test('initialize advertises tools, prompts, and resources', async () => {
    const server = createServer('test-server', '0.0.1');
    registerResources(server, resources);
    registerPrompts(server, prompts);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '0.0.1' }, { capabilities: {} });
    await client.connect(clientTransport);

    try {
      const caps = client.getServerCapabilities();
      expect(caps?.tools).toBeDefined();
      expect(caps?.prompts).toBeDefined();
      expect(caps?.resources).toBeDefined();
    } finally {
      await client.close();
      await server.close();
    }
  });
});

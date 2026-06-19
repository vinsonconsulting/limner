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
      expect(result.prompts).toHaveLength(6);
      const p = result.prompts.find((x) => x.name === 'capability-tour');
      expect(p?.arguments).toEqual([
        { name: 'focus', description: expect.any(String), required: false },
      ]);
    } finally {
      await close();
    }
  });

  test('prompts/list advertises pipeline-router with subject required', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.listPrompts();
      const p = result.prompts.find((x) => x.name === 'pipeline-router');
      expect(p).toBeDefined();
      const subject = p!.arguments?.find((a) => a.name === 'subject');
      expect(subject?.required).toBe(true);
    } finally {
      await close();
    }
  });

  test('prompts/list advertises midjourney-builder with subject required', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.listPrompts();
      const p = result.prompts.find((x) => x.name === 'midjourney-builder');
      expect(p).toBeDefined();
      const subject = p!.arguments?.find((a) => a.name === 'subject');
      expect(subject?.required).toBe(true);
    } finally {
      await close();
    }
  });

  test('prompts/list advertises dalle-builder with subject required', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.listPrompts();
      const p = result.prompts.find((x) => x.name === 'dalle-builder');
      expect(p).toBeDefined();
      const subject = p!.arguments?.find((a) => a.name === 'subject');
      expect(subject?.required).toBe(true);
    } finally {
      await close();
    }
  });

  test('prompts/list advertises recraft-builder with subject required', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.listPrompts();
      const p = result.prompts.find((x) => x.name === 'recraft-builder');
      expect(p).toBeDefined();
      const subject = p!.arguments?.find((a) => a.name === 'subject');
      expect(subject?.required).toBe(true);
    } finally {
      await close();
    }
  });

  test('prompts/list advertises illuminated-manuscript with subject required', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.listPrompts();
      const p = result.prompts.find((x) => x.name === 'illuminated-manuscript');
      expect(p).toBeDefined();
      const subject = p!.arguments?.find((a) => a.name === 'subject');
      expect(subject?.required).toBe(true);
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

  test('prompts/get returns the pipeline-router-derived message with the subject', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'pipeline-router',
        arguments: { subject: 'a scalable app icon' },
      });
      const m = result.messages[0]!;
      expect(m.role).toBe('user');
      const text = (m.content as { text: string }).text;
      // The guidance slice appears verbatim (byte-identical to the serializer).
      expect(text).toContain(serializeGuidance(getGuidance('pipeline-router')!));
      expect(text).toContain('recommend a pipeline (and any finishing steps) for: a scalable app icon');
    } finally {
      await close();
    }
  });

  test('prompts/get threads the priorities knob into the pipeline-router message', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'pipeline-router',
        arguments: { subject: 'a logo', priorities: 'must be vector' },
      });
      const text = (result.messages[0]!.content as { text: string }).text;
      expect(text).toContain('Priorities: must be vector');
    } finally {
      await close();
    }
  });

  test('prompts/get rejects pipeline-router without the required subject', async () => {
    const { client, close } = await connected();
    try {
      await expect(client.getPrompt({ name: 'pipeline-router' })).rejects.toThrow();
    } finally {
      await close();
    }
  });

  test('prompts/get returns the midjourney-recipe-derived message with the subject', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'midjourney-builder',
        arguments: { subject: 'a brass compass on a sea chart' },
      });
      const m = result.messages[0]!;
      expect(m.role).toBe('user');
      const text = (m.content as { text: string }).text;
      // The guidance slice appears verbatim (byte-identical to the serializer).
      expect(text).toContain(serializeGuidance(getGuidance('midjourney-recipe')!));
      expect(text).toContain('build a Midjourney prompt for: a brass compass on a sea chart');
    } finally {
      await close();
    }
  });

  test('prompts/get threads optional knobs into the midjourney-builder message', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'midjourney-builder',
        arguments: { subject: 'a lighthouse', aspect: '16:9' },
      });
      const text = (result.messages[0]!.content as { text: string }).text;
      expect(text).toContain('Aspect ratio: 16:9');
    } finally {
      await close();
    }
  });

  test('prompts/get rejects midjourney-builder without the required subject', async () => {
    const { client, close } = await connected();
    try {
      await expect(client.getPrompt({ name: 'midjourney-builder' })).rejects.toThrow();
    } finally {
      await close();
    }
  });

  test('prompts/get returns the dalle-recipe-derived message with the subject', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'dalle-builder',
        arguments: { subject: 'a transparent OPEN sign' },
      });
      const text = (result.messages[0]!.content as { text: string }).text;
      expect(text).toContain(serializeGuidance(getGuidance('dalle-recipe')!));
      expect(text).toContain('write a DALL·E prompt for: a transparent OPEN sign');
    } finally {
      await close();
    }
  });

  test('prompts/get threads optional knobs into the dalle-builder message', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'dalle-builder',
        arguments: { subject: 'a logo', background: 'transparent' },
      });
      const text = (result.messages[0]!.content as { text: string }).text;
      expect(text).toContain('Background: transparent');
    } finally {
      await close();
    }
  });

  test('prompts/get rejects dalle-builder without the required subject', async () => {
    const { client, close } = await connected();
    try {
      await expect(client.getPrompt({ name: 'dalle-builder' })).rejects.toThrow();
    } finally {
      await close();
    }
  });

  test('prompts/get returns the recraft-recipe-derived message with the subject', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'recraft-builder',
        arguments: { subject: 'a fox-head logo' },
      });
      const text = (result.messages[0]!.content as { text: string }).text;
      expect(text).toContain(serializeGuidance(getGuidance('recraft-recipe')!));
      expect(text).toContain('write a Recraft prompt for: a fox-head logo');
    } finally {
      await close();
    }
  });

  test('prompts/get threads optional knobs into the recraft-builder message', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'recraft-builder',
        arguments: { subject: 'an icon set', style: 'vector_illustration' },
      });
      const text = (result.messages[0]!.content as { text: string }).text;
      expect(text).toContain('Style: vector_illustration');
    } finally {
      await close();
    }
  });

  test('prompts/get rejects recraft-builder without the required subject', async () => {
    const { client, close } = await connected();
    try {
      await expect(client.getPrompt({ name: 'recraft-builder' })).rejects.toThrow();
    } finally {
      await close();
    }
  });

  test('prompts/get returns the illuminated-manuscript loop framing with the subject', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'illuminated-manuscript',
        arguments: { subject: 'the opening of Genesis' },
      });
      const text = (result.messages[0]!.content as { text: string }).text;
      expect(text).toContain(serializeGuidance(getGuidance('illuminated-manuscript')!));
      expect(text).toContain('produce an illuminated manuscript page for: the opening of Genesis');
      expect(text).toContain('research the tradition');
    } finally {
      await close();
    }
  });

  test('prompts/get threads the tradition into the illuminated-manuscript message', async () => {
    const { client, close } = await connected();
    try {
      const result = await client.getPrompt({
        name: 'illuminated-manuscript',
        arguments: { subject: 'a calendar page', tradition: 'Insular' },
      });
      const text = (result.messages[0]!.content as { text: string }).text;
      expect(text).toContain('Tradition to research: Insular');
    } finally {
      await close();
    }
  });

  test('prompts/get rejects illuminated-manuscript without the required subject', async () => {
    const { client, close } = await connected();
    try {
      await expect(client.getPrompt({ name: 'illuminated-manuscript' })).rejects.toThrow();
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

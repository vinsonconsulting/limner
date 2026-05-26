import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { defineTool, type CustomTool } from '../src/runtime.js';

describe('runtime: defineTool', () => {
  test('returns its input tool unchanged (identity helper for type inference)', () => {
    const t: CustomTool<{ msg: string }> = defineTool({
      name: 'echo',
      description: 'echo the input',
      inputSchema: z.object({ msg: z.string() }),
      run: async ({ msg }) => msg,
    });
    expect(t.name).toBe('echo');
    expect(t.description).toBe('echo the input');
    expect(typeof t.run).toBe('function');
  });

  test('supports optional `requires` predicate', () => {
    const t = defineTool({
      name: 'needs_db',
      description: 'needs D1',
      inputSchema: z.object({}),
      requires: (env) => Boolean(env['DB']),
      run: async () => 'ok',
    });
    expect(t.requires!({})).toBe(false);
    expect(t.requires!({ DB: 'fake' })).toBe(true);
  });
});

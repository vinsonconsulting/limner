import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createMemoryStore, type MemoryStore } from '../src/memory/index.js';
import { type Fixture, makeD1Fixture, makeLocalFixture } from './helpers/fixtures.js';

type FixtureFactory = () => Promise<Fixture>;

// Same suite runs against both backends. Behavioral parity is the contract
// @limner/core promises consumers (Phases 2–7).
function runMemorySuite(name: string, makeFixture: FixtureFactory): void {
  describe(`MemoryStore — ${name}`, () => {
    let fixture: Fixture;
    let store: MemoryStore;

    beforeEach(async () => {
      fixture = await makeFixture();
      store = createMemoryStore(fixture.bindings);
    });

    afterEach(async () => {
      await fixture.dispose();
    });

    test('record returns entry with ULID, content, and timestamps', async () => {
      const entry = await store.record({ content: 'first memory' });
      expect(entry.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(entry.content).toBe('first memory');
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.updatedAt).toBe(entry.createdAt);
      expect(entry.category).toBeUndefined();
      expect(entry.sourceId).toBeUndefined();
      expect(entry.metadata).toBeUndefined();
    });

    test('record with category and metadata round-trips', async () => {
      const entry = await store.record({
        content: 'tagged',
        category: 'snippets',
        metadata: { lang: 'ts', tags: ['draft', 'review'] },
      });
      expect(entry.category).toBe('snippets');
      expect(entry.metadata).toEqual({ lang: 'ts', tags: ['draft', 'review'] });

      const fetched = await store.get(entry.id);
      expect(fetched?.metadata).toEqual({ lang: 'ts', tags: ['draft', 'review'] });
    });

    test('get returns null for unknown id', async () => {
      const fetched = await store.get('01J0NONEXISTENTULIDXXX0000');
      expect(fetched).toBeNull();
    });

    test('recall returns most recent first', async () => {
      await store.record({ content: 'first' });
      await new Promise((r) => setTimeout(r, 2));
      await store.record({ content: 'second' });
      await new Promise((r) => setTimeout(r, 2));
      await store.record({ content: 'third' });
      const all = await store.recall();
      expect(all.map((e) => e.content)).toEqual(['third', 'second', 'first']);
    });

    test('recall filters by category', async () => {
      await store.record({ content: 'a', category: 'x' });
      await store.record({ content: 'b', category: 'y' });
      await store.record({ content: 'c', category: 'x' });
      const xs = await store.recall({ category: 'x' });
      expect(xs.map((e) => e.content).sort()).toEqual(['a', 'c']);
    });

    test('recall by q matches content substring', async () => {
      await store.record({ content: 'apple pie' });
      await store.record({ content: 'banana bread' });
      await store.record({ content: 'apple sauce' });
      const apples = await store.recall({ q: 'apple' });
      expect(apples.map((e) => e.content).sort()).toEqual(['apple pie', 'apple sauce']);
    });

    test('recall respects limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await store.record({ content: `e${i}` });
        await new Promise((r) => setTimeout(r, 2));
      }
      const page1 = await store.recall({ limit: 2, offset: 0 });
      const page2 = await store.recall({ limit: 2, offset: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0]!.id).not.toBe(page2[0]!.id);
    });

    test('recall filters by since/until timestamp window', async () => {
      const t0 = Date.now();
      await store.record({ content: 'a' });
      await new Promise((r) => setTimeout(r, 5));
      const mid = Date.now();
      await new Promise((r) => setTimeout(r, 5));
      await store.record({ content: 'b' });
      const recent = await store.recall({ since: mid });
      expect(recent.map((e) => e.content)).toEqual(['b']);
      const window = await store.recall({ since: t0 - 1, until: mid });
      expect(window.map((e) => e.content)).toEqual(['a']);
    });

    test('forget removes entry and returns true', async () => {
      const entry = await store.record({ content: 'transient' });
      const removed = await store.forget(entry.id);
      expect(removed).toBe(true);
      expect(await store.get(entry.id)).toBeNull();
    });

    test('forget returns false for unknown id', async () => {
      const removed = await store.forget('01J0NONEXISTENTULIDXXX0000');
      expect(removed).toBe(false);
    });

    test('listCategories returns counts grouped by category, skipping null', async () => {
      await store.record({ content: 'a', category: 'x' });
      await store.record({ content: 'b', category: 'x' });
      await store.record({ content: 'c', category: 'y' });
      await store.record({ content: 'd' });
      const cats = await store.listCategories();
      expect(cats).toEqual([
        { category: 'x', count: 2 },
        { category: 'y', count: 1 },
      ]);
    });

    test('record with sourceId upserts on conflict (Phase 6 backfill idempotency)', async () => {
      const first = await store.record({ content: 'v1', sourceId: 'ext-123' });
      const second = await store.record({ content: 'v2', sourceId: 'ext-123' });
      expect(second.id).toBe(first.id);
      expect(second.sourceId).toBe('ext-123');
      expect(second.content).toBe('v2');
      expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);

      const all = await store.recall();
      expect(all.filter((e) => e.sourceId === 'ext-123')).toHaveLength(1);
    });
  });
}

runMemorySuite('Local', makeLocalFixture);
runMemorySuite('D1', makeD1Fixture);

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createProjectStore, type ProjectStore } from '../src/context/index.js';
import { type Fixture, makeD1Fixture, makeLocalFixture } from './helpers/fixtures.js';

type FixtureFactory = () => Promise<Fixture>;

function runProjectSuite(name: string, makeFixture: FixtureFactory): void {
  describe(`ProjectStore — ${name}`, () => {
    let fixture: Fixture;
    let store: ProjectStore;

    beforeEach(async () => {
      fixture = await makeFixture();
      store = createProjectStore(fixture.bindings);
    });

    afterEach(async () => {
      await fixture.dispose();
    });

    test('create + get round-trip including metadata JSON', async () => {
      const p = await store.create({
        name: 'rasa',
        description: 'foundation variant',
        metadata: { tags: ['oss', 'foundation'], owner: 'jim' },
      });
      const fetched = await store.get(p.id);
      expect(fetched).toEqual(p);
      expect(fetched?.metadata).toEqual({ tags: ['oss', 'foundation'], owner: 'jim' });
    });

    test('getByName uses the UNIQUE name index', async () => {
      const created = await store.create({ name: 'pixel' });
      const fetched = await store.getByName('pixel');
      expect(fetched?.id).toBe(created.id);
      expect(await store.getByName('nonexistent')).toBeNull();
    });

    test('list orders by updated_at DESC', async () => {
      const a = await store.create({ name: 'a' });
      await new Promise((r) => setTimeout(r, 5));
      await store.create({ name: 'b' });
      await new Promise((r) => setTimeout(r, 5));
      await store.update(a.id, { description: 'updated' });
      const list = await store.list();
      expect(list[0]?.name).toBe('a');
    });

    test('list q matches name or description substring', async () => {
      await store.create({ name: 'rasa', description: 'foundation' });
      await store.create({ name: 'pixel', description: 'sprite work' });
      await store.create({ name: 'ascii', description: 'private variant' });
      const hits = await store.list({ q: 'rasa' });
      expect(hits.map((p) => p.name).sort()).toEqual(['rasa']);
      const sprite = await store.list({ q: 'sprite' });
      expect(sprite.map((p) => p.name).sort()).toEqual(['pixel']);
    });

    test('update changes only specified fields and bumps updated_at', async () => {
      const p = await store.create({ name: 'x', description: 'orig' });
      const originalUpdatedAt = p.updatedAt;
      await new Promise((r) => setTimeout(r, 5));
      const updated = await store.update(p.id, { metadata: { v: 1 } });
      expect(updated?.description).toBe('orig');
      expect(updated?.metadata).toEqual({ v: 1 });
      expect(updated!.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    test('update description: null clears it; undefined leaves it unchanged (A6)', async () => {
      const p = await store.create({ name: 'clearable', description: 'orig' });
      // undefined → field omitted from the UPDATE, description preserved.
      const kept = await store.update(p.id, { metadata: { v: 1 } });
      expect(kept?.description).toBe('orig');
      // null → bound as SQL NULL, clearing it (reads back as undefined).
      const cleared = await store.update(p.id, { description: null });
      expect(cleared?.description).toBeUndefined();
      // Persisted, not just reflected in the return value.
      expect((await store.get(p.id))?.description).toBeUndefined();
    });

    test('delete returns true once, false on repeat', async () => {
      const p = await store.create({ name: 'doomed' });
      expect(await store.delete(p.id)).toBe(true);
      expect(await store.get(p.id)).toBeNull();
      expect(await store.delete(p.id)).toBe(false);
    });

    test('addNote + listNotes round-trip and order newest-first', async () => {
      const p = await store.create({ name: 'with-notes' });
      await store.addNote({ projectId: p.id, content: 'first note' });
      await new Promise((r) => setTimeout(r, 5));
      await store.addNote({
        projectId: p.id,
        content: 'second note',
        metadata: { tag: 'reviewed' },
      });
      const notes = await store.listNotes(p.id);
      expect(notes.map((n) => n.content)).toEqual(['second note', 'first note']);
      expect(notes[0]?.metadata).toEqual({ tag: 'reviewed' });
    });

    test('delete cascades to project_notes (FK ON DELETE CASCADE)', async () => {
      const p = await store.create({ name: 'cascading' });
      await store.addNote({ projectId: p.id, content: 'note' });
      await store.delete(p.id);
      const notes = await store.listNotes(p.id);
      expect(notes).toHaveLength(0);
    });
  });
}

runProjectSuite('Local', makeLocalFixture);
runProjectSuite('D1', makeD1Fixture);

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  A4_FRAMING,
  createProjectStore,
  getGuidance,
  mergeStyleProfile,
  parseStyleProfile,
  readStyleProfile,
  serializeGuidance,
  STYLE_PROFILE_KEY,
  StyleProfileSchema,
  upsertStyleProfile,
  writeStyleProfile,
  type ProjectStore,
  type StyleProfile,
} from '../src/index.js';
import { type Fixture, makeD1Fixture, makeLocalFixture } from './helpers/fixtures.js';

type FixtureFactory = () => Promise<Fixture>;

const FULL_PROFILE: StyleProfile = {
  version: 1,
  palette: [{ hex: '#1a2b3c', name: 'midnight' }, { hex: '#fff' }],
  descriptors: ['cinematic', 'high-contrast'],
  medium: 'isometric vector',
  pipelinePrefs: {
    preferred: 'recraft',
    recraft: { style: 'vector_illustration', substyle: 'line_art' },
    midjourney: { style: 'raw', stylize: 250 },
  },
  references: [{ ref: 'https://example.com/board.png', kind: 'image', note: 'mood board' }],
  provenance: { source: 'brand-kit', updatedAt: 1_700_000_000_000 },
};

// ---------------- Schema (backend-independent) ----------------

describe('StyleProfileSchema', () => {
  test('an empty object parses to the versioned default', () => {
    expect(StyleProfileSchema.parse({})).toEqual({ version: 1 });
  });

  test('a full profile round-trips through parse', () => {
    expect(parseStyleProfile(FULL_PROFILE)).toEqual(FULL_PROFILE);
  });

  test('rejects a malformed hex color', () => {
    const bad = StyleProfileSchema.safeParse({ palette: [{ hex: 'red' }] });
    expect(bad.success).toBe(false);
  });

  test('rejects an out-of-range midjourney stylize', () => {
    const bad = StyleProfileSchema.safeParse({
      pipelinePrefs: { midjourney: { stylize: 5000 } },
    });
    expect(bad.success).toBe(false);
  });

  test('parseStyleProfile throws on an invalid value', () => {
    expect(() => parseStyleProfile({ version: 2 })).toThrow();
  });
});

describe('mergeStyleProfile', () => {
  test('top-level patch fields override the base and re-validate', () => {
    const base = StyleProfileSchema.parse({ descriptors: ['flat'], medium: 'gouache' });
    const merged = mergeStyleProfile(base, { medium: 'oil', descriptors: ['noir'] });
    expect(merged.medium).toBe('oil');
    expect(merged.descriptors).toEqual(['noir']); // array replaced, not concatenated
    expect(merged.version).toBe(1);
  });

  test('ignores undefined patch values', () => {
    const base = StyleProfileSchema.parse({ medium: 'ink' });
    const merged = mergeStyleProfile(base, { medium: undefined });
    expect(merged.medium).toBe('ink');
  });
});

// ---------------- Store helpers (parity across backends) ----------------

function runStyleProfileSuite(name: string, makeFixture: FixtureFactory): void {
  describe(`style-profile store — ${name}`, () => {
    let fixture: Fixture;
    let store: ProjectStore;

    beforeEach(async () => {
      fixture = await makeFixture();
      store = createProjectStore(fixture.bindings);
    });

    afterEach(async () => {
      await fixture.dispose();
    });

    test('write then read round-trips', async () => {
      const p = await store.create({ name: 'rp' });
      const written = await writeStyleProfile(store, p.id, FULL_PROFILE);
      expect(written).toEqual(FULL_PROFILE);
      expect(await readStyleProfile(store, p.id)).toEqual(FULL_PROFILE);
    });

    test('write preserves sibling project metadata', async () => {
      const p = await store.create({
        name: 'siblings',
        metadata: { owner: 'jim', tags: ['oss'] },
      });
      await writeStyleProfile(store, p.id, { descriptors: ['minimal'] });
      const fetched = await store.get(p.id);
      expect(fetched?.metadata?.owner).toBe('jim');
      expect(fetched?.metadata?.tags).toEqual(['oss']);
      expect(fetched?.metadata?.[STYLE_PROFILE_KEY]).toBeDefined();
    });

    test('upsert is read/merge/write — bootstraps then merges', async () => {
      const p = await store.create({ name: 'upsert' });
      const first = await upsertStyleProfile(store, p.id, { descriptors: ['flat'] });
      expect(first.descriptors).toEqual(['flat']);
      const second = await upsertStyleProfile(store, p.id, { medium: 'vector' });
      expect(second.descriptors).toEqual(['flat']); // preserved from first
      expect(second.medium).toBe('vector'); // added by second
      expect(await readStyleProfile(store, p.id)).toEqual(second);
    });

    test('read returns null when no profile is set', async () => {
      const p = await store.create({ name: 'empty' });
      expect(await readStyleProfile(store, p.id)).toBeNull();
    });

    test('read returns null for an unknown project', async () => {
      expect(await readStyleProfile(store, '01J0NONEXISTENTPROJECT00000')).toBeNull();
    });

    test('write throws for an unknown project', async () => {
      await expect(
        writeStyleProfile(store, '01J0NONEXISTENTPROJECT00000', {}),
      ).rejects.toThrow(/project not found/);
    });

    test('read throws when a stored profile is corrupt', async () => {
      const p = await store.create({ name: 'corrupt' });
      // Inject an invalid profile straight onto metadata, bypassing validation.
      await store.update(p.id, { metadata: { [STYLE_PROFILE_KEY]: { version: 2, palette: 'nope' } } });
      await expect(readStyleProfile(store, p.id)).rejects.toThrow();
    });
  });
}

runStyleProfileSuite('Local', makeLocalFixture);
runStyleProfileSuite('D1', makeD1Fixture);

// ---------------- Guidance entry ----------------

describe('style-profile guidance entry', () => {
  test('is registered and serializes its shape with A4 framing', () => {
    expect(getGuidance('style-profile')?.id).toBe('style-profile');
    const md = serializeGuidance(getGuidance('style-profile')!);
    expect(md).toContain(A4_FRAMING);
    expect(md).toContain('palette');
    expect(md).toContain('provenance');
    expect(md).toContain('pipelinePrefs');
  });
});

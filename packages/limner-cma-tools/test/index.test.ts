import { describe, expect, test } from 'vitest';

import { LIMNER_TOOLS } from '../src/index.js';

describe('LIMNER_TOOLS registry', () => {
  test('exposes 15 tools total', () => {
    expect(LIMNER_TOOLS).toHaveLength(15);
  });

  test('all tool names are unique', () => {
    const names = LIMNER_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('all expected tool names present (mirrors Path B)', () => {
    const names = LIMNER_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'limner_compose',
        'limner_forget',
        'limner_generate_dalle',
        'limner_generate_midjourney',
        'limner_generate_recraft',
        'limner_get_project_context',
        'limner_health',
        'limner_list_categories',
        'limner_list_pipelines',
        'limner_list_projects',
        'limner_pipeline_capabilities',
        'limner_recall',
        'limner_record',
        'limner_record_project_note',
        'limner_version',
      ],
    );
  });

  test('every tool has a non-empty description', () => {
    for (const t of LIMNER_TOOLS) {
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  test('image-returning tools gate on env.BUCKET', () => {
    const imageTools = ['limner_generate_dalle', 'limner_generate_recraft', 'limner_compose'];
    for (const name of imageTools) {
      const t = LIMNER_TOOLS.find((x) => x.name === name);
      expect(t).toBeDefined();
      expect(t!.requires).toBeDefined();
      expect(t!.requires!({})).toBe(false);
    }
  });

  test('memory + project tools gate on env.DB', () => {
    const dbTools = ['limner_recall', 'limner_record', 'limner_forget', 'limner_list_categories', 'limner_list_projects', 'limner_get_project_context', 'limner_record_project_note'];
    for (const name of dbTools) {
      const t = LIMNER_TOOLS.find((x) => x.name === name);
      expect(t).toBeDefined();
      expect(t!.requires).toBeDefined();
      expect(t!.requires!({})).toBe(false);
      expect(t!.requires!({ DB: {} })).toBe(true);
    }
  });

  test('meta tools have no requires gate', () => {
    const metaToolNames = ['limner_health', 'limner_version', 'limner_list_pipelines', 'limner_pipeline_capabilities'];
    for (const name of metaToolNames) {
      const t = LIMNER_TOOLS.find((x) => x.name === name);
      expect(t).toBeDefined();
      expect(t!.requires).toBeUndefined();
    }
  });

  test('generate_midjourney has no requires gate (offline composition)', () => {
    const t = LIMNER_TOOLS.find((x) => x.name === 'limner_generate_midjourney');
    expect(t).toBeDefined();
    expect(t!.requires).toBeUndefined();
  });
});

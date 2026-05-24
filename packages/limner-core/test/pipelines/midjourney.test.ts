import { describe, expect, test } from 'vitest';

import {
  MidjourneyPipeline,
  type MidjourneyOptions,
  PipelineError,
  type PipelineContext,
  type PipelineGenerateInput,
  type PipelineTextOutput,
} from '../../src/index.js';

const ctx: PipelineContext = { secrets: {} };

function gen(
  prompt: string,
  options?: MidjourneyOptions,
  extra?: Partial<PipelineGenerateInput>,
): Promise<PipelineTextOutput> {
  const pipeline = new MidjourneyPipeline();
  const input: PipelineGenerateInput = { prompt, ...(options ? { options } : {}), ...extra };
  return pipeline.generate(input, ctx).then((out) => out as PipelineTextOutput);
}

describe('MidjourneyPipeline — metadata', () => {
  test('exposes id, displayName, kind, requiredSecrets', () => {
    const p = new MidjourneyPipeline();
    expect(p.id).toBe('midjourney');
    expect(p.displayName).toBe('Midjourney');
    expect(p.kind).toBe('api');
    expect(p.requiredSecrets).toEqual([]);
  });
});

describe('MidjourneyPipeline — prompt handling', () => {
  test('bare prompt returns trimmed text output', async () => {
    const out = await gen('   a cat in a hat   ');
    expect(out.kind).toBe('text');
    expect(out.content).toBe('a cat in a hat');
  });

  test('empty prompt throws invalid_input', async () => {
    const p = new MidjourneyPipeline();
    await expect(p.generate({ prompt: '' }, ctx)).rejects.toBeInstanceOf(PipelineError);
    await expect(p.generate({ prompt: '   ' }, ctx)).rejects.toMatchObject({
      pipelineId: 'midjourney',
      code: 'invalid_input',
    });
  });
});

describe('MidjourneyPipeline — aspect ratio', () => {
  test('valid ratio formats as --ar', async () => {
    const out = await gen('cat', { aspectRatio: '16:9' });
    expect(out.content).toBe('cat --ar 16:9');
  });

  test('invalid ratio format throws invalid_input', async () => {
    const p = new MidjourneyPipeline();
    await expect(p.generate({ prompt: 'cat', options: { aspectRatio: '16x9' } }, ctx))
      .rejects.toMatchObject({ code: 'invalid_input' });
    await expect(p.generate({ prompt: 'cat', options: { aspectRatio: 'square' } }, ctx))
      .rejects.toMatchObject({ code: 'invalid_input' });
  });
});

describe('MidjourneyPipeline — version routing', () => {
  test('v-series version uses --v', async () => {
    expect((await gen('cat', { version: 'v6' })).content).toBe('cat --v 6');
    expect((await gen('cat', { version: 'v6.1' })).content).toBe('cat --v 6.1');
    expect((await gen('cat', { version: 'v7' })).content).toBe('cat --v 7');
  });

  test('niji version uses --niji', async () => {
    expect((await gen('cat', { version: 'niji-5' })).content).toBe('cat --niji 5');
    expect((await gen('cat', { version: 'niji-6' })).content).toBe('cat --niji 6');
  });
});

describe('MidjourneyPipeline — style and numeric knobs', () => {
  test('style preset emits --style', async () => {
    expect((await gen('cat', { style: 'raw' })).content).toBe('cat --style raw');
  });

  test('stylize, weird, chaos formatted with values', async () => {
    expect((await gen('cat', { stylize: 250 })).content).toBe('cat --stylize 250');
    expect((await gen('cat', { weird: 100 })).content).toBe('cat --weird 100');
    expect((await gen('cat', { chaos: 50 })).content).toBe('cat --chaos 50');
  });

  test('stylize=0 and chaos=0 still emit (not falsy-skipped)', async () => {
    expect((await gen('cat', { stylize: 0 })).content).toBe('cat --stylize 0');
    expect((await gen('cat', { chaos: 0 })).content).toBe('cat --chaos 0');
  });

  test('stylize out of range throws', async () => {
    const p = new MidjourneyPipeline();
    await expect(p.generate({ prompt: 'cat', options: { stylize: -1 } }, ctx))
      .rejects.toMatchObject({ code: 'invalid_input' });
    await expect(p.generate({ prompt: 'cat', options: { stylize: 1001 } }, ctx))
      .rejects.toMatchObject({ code: 'invalid_input' });
  });

  test('weird out of range throws', async () => {
    const p = new MidjourneyPipeline();
    await expect(p.generate({ prompt: 'cat', options: { weird: 3001 } }, ctx))
      .rejects.toMatchObject({ code: 'invalid_input' });
  });

  test('chaos out of range throws', async () => {
    const p = new MidjourneyPipeline();
    await expect(p.generate({ prompt: 'cat', options: { chaos: 101 } }, ctx))
      .rejects.toMatchObject({ code: 'invalid_input' });
  });
});

describe('MidjourneyPipeline — tile and quality', () => {
  test('tile=true emits --tile, false omits', async () => {
    expect((await gen('cat', { tile: true })).content).toBe('cat --tile');
    expect((await gen('cat', { tile: false })).content).toBe('cat');
  });

  test('quality emits --q', async () => {
    expect((await gen('cat', { quality: 1 })).content).toBe('cat --q 1');
    expect((await gen('cat', { quality: 0.5 })).content).toBe('cat --q 0.5');
  });
});

describe('MidjourneyPipeline — negative prompts', () => {
  test('options.no emits --no with comma-separated list', async () => {
    expect((await gen('cat', { no: ['hands', 'text'] })).content)
      .toBe('cat --no hands, text');
  });

  test('input.negativePrompt and options.no merge', async () => {
    const out = await gen('cat', { no: ['text'] }, { negativePrompt: 'hands' });
    expect(out.content).toBe('cat --no hands, text');
  });

  test('input.negativePrompt alone (no options.no) emits --no', async () => {
    const out = await gen('cat', undefined, { negativePrompt: 'hands' });
    expect(out.content).toBe('cat --no hands');
  });

  test('empty options.no array does not emit --no', async () => {
    expect((await gen('cat', { no: [] })).content).toBe('cat');
  });
});

describe('MidjourneyPipeline — seed precedence', () => {
  test('options.seed wins over input.seed', async () => {
    const out = await gen('cat', { seed: 999 }, { seed: 123 });
    expect(out.content).toBe('cat --seed 999');
  });

  test('input.seed used when options.seed absent', async () => {
    const out = await gen('cat', undefined, { seed: 123 });
    expect(out.content).toBe('cat --seed 123');
  });
});

describe('MidjourneyPipeline — composition', () => {
  test('multi-option prompt assembles in expected order', async () => {
    const out = await gen('a sweeping mountain vista', {
      aspectRatio: '21:9',
      version: 'v6.1',
      style: 'raw',
      stylize: 300,
      chaos: 20,
      tile: false,
      no: ['people', 'text'],
      seed: 42,
      quality: 2,
    });
    expect(out.content).toBe(
      'a sweeping mountain vista --no people, text --ar 21:9 --v 6.1 --style raw --stylize 300 --chaos 20 --seed 42 --q 2',
    );
  });

  test('niji preset with style and aspect ratio', async () => {
    const out = await gen('anime portrait', {
      version: 'niji-6',
      aspectRatio: '3:4',
      style: 'cute',
    });
    expect(out.content).toBe('anime portrait --ar 3:4 --niji 6 --style cute');
  });
});

describe('MidjourneyPipeline — output metadata', () => {
  test('metadata includes pipeline id and options', async () => {
    const out = await gen('cat', { aspectRatio: '1:1' });
    expect(out.metadata).toEqual({
      pipeline: 'midjourney',
      options: { aspectRatio: '1:1' },
    });
  });

  test('metadata includes negativePrompt when set on input', async () => {
    const out = await gen('cat', undefined, { negativePrompt: 'hands' });
    expect(out.metadata).toMatchObject({
      pipeline: 'midjourney',
      negativePrompt: 'hands',
    });
  });
});

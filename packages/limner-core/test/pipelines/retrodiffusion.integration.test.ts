import { describe, expect, test } from 'vitest';

import {
  RetroDiffusionPipeline,
  type PipelineImageOutput,
} from '../../src/index.js';

const apiKey = process.env['RETRODIFFUSION_API_KEY'];

describe.skipIf(!apiKey)(
  'RetroDiffusionPipeline — integration (requires RETRODIFFUSION_API_KEY)',
  () => {
    test('generates a small pixel-art image', { timeout: 90_000 }, async () => {
      const p = new RetroDiffusionPipeline();
      const out = (await p.generate(
        {
          prompt: 'tiny pixel art cat',
          width: 64,
          height: 64,
          options: { promptStyle: 'rd_fast__default', numImages: 1 },
        },
        { secrets: { RETRODIFFUSION_API_KEY: apiKey! } },
      )) as PipelineImageOutput;

      expect(out.kind).toBe('image');
      expect(out.data).toBeInstanceOf(Uint8Array);
      expect(out.data!.length).toBeGreaterThan(0);
      // PNG magic bytes
      expect(out.data!.slice(0, 8)).toEqual(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      expect(out.width).toBe(64);
      expect(out.height).toBe(64);
      expect(out.metadata).toMatchObject({ pipeline: 'retrodiffusion' });
    });
  },
);

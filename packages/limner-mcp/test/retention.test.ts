import { describe, expect, test, vi } from 'vitest';
import type { R2Bucket, R2Object, R2Objects } from '@cloudflare/workers-types';

import { sweepExpiredArtifacts, RETENTION_DAYS } from '../src/retention.js';

const DAY_MS = 86_400_000;
const NOW = 1_000 * DAY_MS; // fixed, injected "now" so the cutoff is deterministic

// Minimal R2Object stub — the sweep only reads `.key` and `.uploaded`.
function obj(key: string, ageDays: number): R2Object {
  return { key, uploaded: new Date(NOW - ageDays * DAY_MS) } as unknown as R2Object;
}

// Build a mock R2Bucket that returns the given list() pages in order. A page
// with `nextCursor` is reported truncated; the final page is not.
function mockBucket(pages: Array<{ objects: R2Object[]; nextCursor?: string }>) {
  let i = 0;
  const list = vi.fn(async (_opts?: { cursor?: string; limit?: number }): Promise<R2Objects> => {
    const page = pages[i++]!;
    const base = { objects: page.objects, delimitedPrefixes: [] as string[] };
    return (
      page.nextCursor ? { ...base, truncated: true, cursor: page.nextCursor } : { ...base, truncated: false }
    ) as R2Objects;
  });
  const del = vi.fn(async (_keys: string | string[]): Promise<void> => {});
  return { bucket: { list, delete: del } as unknown as R2Bucket, list, del };
}

describe('sweepExpiredArtifacts', () => {
  test('deletes objects older than the retention window, keeps fresh ones', async () => {
    const { bucket, del } = mockBucket([{ objects: [obj('old.png', 31), obj('fresh.png', 29)] }]);

    const res = await sweepExpiredArtifacts(bucket, NOW);

    expect(res.scanned).toBe(2);
    expect(res.deleted).toBe(1);
    expect(res.cutoff).toBe(NOW - RETENTION_DAYS * DAY_MS);
    expect(del).toHaveBeenCalledWith(['old.png']);
  });

  test('cutoff is strict — an object uploaded exactly RETENTION_DAYS ago is kept', async () => {
    const { bucket, del } = mockBucket([{ objects: [obj('boundary.png', RETENTION_DAYS), obj('over.png', RETENTION_DAYS + 1)] }]);

    const res = await sweepExpiredArtifacts(bucket, NOW);

    expect(res.deleted).toBe(1);
    expect(del).toHaveBeenCalledWith(['over.png']);
  });

  test('paginates: follows the cursor and sweeps every page', async () => {
    const { bucket, list, del } = mockBucket([
      { objects: [obj('p1-old.png', 40)], nextCursor: 'c1' },
      { objects: [obj('p2-old.png', 40), obj('p2-fresh.png', 1)] },
    ]);

    const res = await sweepExpiredArtifacts(bucket, NOW);

    expect(list).toHaveBeenCalledTimes(2);
    // Second list() call carries the cursor returned by the first page.
    expect(list.mock.calls[1]![0]).toMatchObject({ cursor: 'c1' });
    expect(res.scanned).toBe(3);
    expect(res.deleted).toBe(2);
    expect(del).toHaveBeenCalledTimes(2);
  });

  test('no-ops cleanly on an empty bucket', async () => {
    const { bucket, del } = mockBucket([{ objects: [] }]);

    const res = await sweepExpiredArtifacts(bucket, NOW);

    expect(res).toEqual({ scanned: 0, deleted: 0, cutoff: NOW - RETENTION_DAYS * DAY_MS });
    expect(del).not.toHaveBeenCalled();
  });

  test('honors a custom retention window', async () => {
    const { bucket, del } = mockBucket([{ objects: [obj('d8.png', 8), obj('d6.png', 6)] }]);

    const res = await sweepExpiredArtifacts(bucket, NOW, 7);

    expect(res.deleted).toBe(1);
    expect(del).toHaveBeenCalledWith(['d8.png']);
  });
});

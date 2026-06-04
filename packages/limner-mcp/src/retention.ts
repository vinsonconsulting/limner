// R2 artifact retention sweep (RT-2 / D-RA-20).
//
// rasa v1 enforces a 30-day hard-delete on image artifacts stored in R2.
// Native R2 Object Lifecycle rules would be the obvious mechanism, but
// applying them needs the R2 management API (a scope neither the deploy
// token nor the Cloudflare MCP connector currently hold), so retention is
// enforced in-worker instead: a daily cron (`[triggers] crons` in
// wrangler.toml) invokes the scheduled() handler, which calls this sweep.
//
// The sweep only needs the R2 *binding* (data-plane: list + delete), which
// deploy already grants — no management API. `now` is injected so the cutoff
// is deterministic under test.
//
// Ref: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/

import type { R2Bucket } from '@cloudflare/workers-types';

/** Default retention window. Objects older than this are hard-deleted. */
export const RETENTION_DAYS = 30;

const DAY_MS = 86_400_000;
const PAGE_LIMIT = 1000; // R2 list() / delete() both cap at 1000 keys per call.

export interface SweepResult {
  /** Objects examined across all pages. */
  scanned: number;
  /** Objects hard-deleted. */
  deleted: number;
  /** Epoch ms; objects uploaded strictly before this were deleted. */
  cutoff: number;
}

/**
 * Hard-delete R2 objects whose `uploaded` timestamp is older than the
 * retention window. Paginates the bucket and deletes per page (each page is
 * <= PAGE_LIMIT keys, within R2's batch-delete cap). Cursor-based pagination
 * is key-positional, so deleting listed objects does not disturb the cursor.
 */
export async function sweepExpiredArtifacts(
  bucket: R2Bucket,
  now: number,
  retentionDays: number = RETENTION_DAYS,
): Promise<SweepResult> {
  const cutoff = now - retentionDays * DAY_MS;
  let scanned = 0;
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const listing = await bucket.list(cursor ? { cursor, limit: PAGE_LIMIT } : { limit: PAGE_LIMIT });
    const expired: string[] = [];
    for (const object of listing.objects) {
      scanned++;
      if (object.uploaded.getTime() < cutoff) expired.push(object.key);
    }
    if (expired.length > 0) {
      await bucket.delete(expired);
      deleted += expired.length;
    }
    // `cursor` is only present (and typed) when the listing is truncated.
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  return { scanned, deleted, cutoff };
}

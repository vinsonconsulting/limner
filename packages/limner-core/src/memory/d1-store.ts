import type { D1Database } from '@cloudflare/workers-types';
import { ulid } from 'ulid';

import type {
  CategoryCount,
  MemoryEntry,
  MemoryQuery,
  MemoryRecordInput,
} from '../types.js';
import type { MemoryStore, MemoryRow } from './store.js';
import { buildRecallSql, memoryFromRow } from './store.js';

export class D1MemoryStore implements MemoryStore {
  constructor(private readonly db: D1Database) {}

  async record(input: MemoryRecordInput): Promise<MemoryEntry> {
    // Reject empty / whitespace-only content (A6): an empty entry is
    // meaningless and its content matches every recall `q LIKE` filter. The
    // MCP boundary already enforces min(1) via zod; this guards the
    // core-direct / CMA-tools path that bypasses that schema.
    if (input.content.trim().length === 0) {
      throw new Error('memory record: content must not be empty');
    }
    const id = ulid();
    const now = Date.now();
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
    const category = input.category ?? null;

    if (input.sourceId) {
      // Upsert by source_id (idempotency for the Phase 6 CMA-memory backfill).
      await this.db.prepare(
        `INSERT INTO memory_entries (id, content, category, source_id, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_id) DO UPDATE SET
           content    = excluded.content,
           category   = excluded.category,
           updated_at = excluded.updated_at,
           metadata   = excluded.metadata`,
      ).bind(id, input.content, category, input.sourceId, now, now, metadataJson).run();

      const row = await this.db
        .prepare('SELECT * FROM memory_entries WHERE source_id = ?')
        .bind(input.sourceId)
        .first<MemoryRow>();
      if (!row) throw new Error('record: failed to read back upserted row');
      return memoryFromRow(row);
    }

    await this.db.prepare(
      `INSERT INTO memory_entries (id, content, category, source_id, created_at, updated_at, metadata)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    ).bind(id, input.content, category, now, now, metadataJson).run();

    const row = await this.db
      .prepare('SELECT * FROM memory_entries WHERE id = ?')
      .bind(id)
      .first<MemoryRow>();
    if (!row) throw new Error('record: failed to read back inserted row');
    return memoryFromRow(row);
  }

  async recall(query: MemoryQuery = {}): Promise<MemoryEntry[]> {
    const { whereSql, binds } = buildRecallSql(query);
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const sql = `SELECT * FROM memory_entries ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const { results } = await this.db
      .prepare(sql)
      .bind(...binds, limit, offset)
      .all<MemoryRow>();
    return results.map(memoryFromRow);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const row = await this.db
      .prepare('SELECT * FROM memory_entries WHERE id = ?')
      .bind(id)
      .first<MemoryRow>();
    return row ? memoryFromRow(row) : null;
  }

  async forget(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM memory_entries WHERE id = ?')
      .bind(id)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  async listCategories(): Promise<CategoryCount[]> {
    const { results } = await this.db.prepare(
      `SELECT category, COUNT(*) as count FROM memory_entries
       WHERE category IS NOT NULL
       GROUP BY category
       ORDER BY count DESC, category ASC`,
    ).all<CategoryCount>();
    return results;
  }
}

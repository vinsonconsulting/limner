import type Database from 'better-sqlite3';
import { ulid } from 'ulid';

import type {
  CategoryCount,
  MemoryEntry,
  MemoryQuery,
  MemoryRecordInput,
} from '../types.js';
import type { MemoryStore, MemoryRow } from './store.js';
import { buildRecallSql, memoryFromRow } from './store.js';

export class LocalMemoryStore implements MemoryStore {
  constructor(private readonly db: Database.Database) {}

  async record(input: MemoryRecordInput): Promise<MemoryEntry> {
    const id = ulid();
    const now = Date.now();
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
    const category = input.category ?? null;

    if (input.sourceId) {
      this.db.prepare(
        `INSERT INTO memory_entries (id, content, category, source_id, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_id) DO UPDATE SET
           content    = excluded.content,
           category   = excluded.category,
           updated_at = excluded.updated_at,
           metadata   = excluded.metadata`,
      ).run(id, input.content, category, input.sourceId, now, now, metadataJson);

      const row = this.db
        .prepare('SELECT * FROM memory_entries WHERE source_id = ?')
        .get(input.sourceId) as MemoryRow | undefined;
      if (!row) throw new Error('record: failed to read back upserted row');
      return memoryFromRow(row);
    }

    this.db.prepare(
      `INSERT INTO memory_entries (id, content, category, source_id, created_at, updated_at, metadata)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    ).run(id, input.content, category, now, now, metadataJson);

    const row = this.db
      .prepare('SELECT * FROM memory_entries WHERE id = ?')
      .get(id) as MemoryRow | undefined;
    if (!row) throw new Error('record: failed to read back inserted row');
    return memoryFromRow(row);
  }

  async recall(query: MemoryQuery = {}): Promise<MemoryEntry[]> {
    const { whereSql, binds } = buildRecallSql(query);
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const sql = `SELECT * FROM memory_entries ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const rows = this.db.prepare(sql).all(...binds, limit, offset) as MemoryRow[];
    return rows.map(memoryFromRow);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const row = this.db
      .prepare('SELECT * FROM memory_entries WHERE id = ?')
      .get(id) as MemoryRow | undefined;
    return row ? memoryFromRow(row) : null;
  }

  async forget(id: string): Promise<boolean> {
    const result = this.db
      .prepare('DELETE FROM memory_entries WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  async listCategories(): Promise<CategoryCount[]> {
    return this.db.prepare(
      `SELECT category, COUNT(*) as count FROM memory_entries
       WHERE category IS NOT NULL
       GROUP BY category
       ORDER BY count DESC, category ASC`,
    ).all() as CategoryCount[];
  }
}

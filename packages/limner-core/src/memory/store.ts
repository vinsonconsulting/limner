import type {
  CategoryCount,
  MemoryEntry,
  MemoryQuery,
  MemoryRecordInput,
} from '../types.js';

// Backend-agnostic memory contract. D1MemoryStore and LocalMemoryStore both
// implement this; parity tests verify behavioral equivalence.
export interface MemoryStore {
  record(input: MemoryRecordInput): Promise<MemoryEntry>;
  recall(query?: MemoryQuery): Promise<MemoryEntry[]>;
  get(id: string): Promise<MemoryEntry | null>;
  forget(id: string): Promise<boolean>;
  listCategories(): Promise<CategoryCount[]>;
}

// Shared row shape and mapper used by both D1 and Local stores. The wire
// schema is identical (plain SQLite), so the mapper deduplicates the
// snake_case → camelCase conversion.
export type MemoryRow = {
  id: string;
  content: string;
  category: string | null;
  source_id: string | null;
  created_at: number;
  updated_at: number;
  metadata: string | null;
};

export function memoryFromRow(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    content: row.content,
    category: row.category ?? undefined,
    sourceId: row.source_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
  };
}

// Shared SQL fragments built from MemoryQuery. Returns the WHERE clause
// (empty string if no filters) and the ordered list of bind values.
export function buildRecallSql(query: MemoryQuery): { whereSql: string; binds: (string | number)[] } {
  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (query.q) {
    where.push('content LIKE ?');
    binds.push(`%${query.q}%`);
  }
  if (query.category) {
    where.push('category = ?');
    binds.push(query.category);
  }
  if (query.since !== undefined) {
    where.push('created_at >= ?');
    binds.push(query.since);
  }
  if (query.until !== undefined) {
    where.push('created_at <= ?');
    binds.push(query.until);
  }
  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    binds,
  };
}

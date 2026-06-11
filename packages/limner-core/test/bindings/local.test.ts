import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createLocalBindings } from '../../src/bindings/index.js';
import { SCHEMA_PATH } from '../helpers/fixtures.js';

// p1: SQLite can create a missing db file but not a missing parent
// directory. createLocalBindings must mkdir the parent so the stdio
// default path (~/.limner/limner.db) works on a genuine first run.
describe('createLocalBindings file-backed db', () => {
  let base: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'limner-local-bindings-'));
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  test('boots on a deeply nested nonexistent path, persists, and reopens', () => {
    const dbPath = join(base, 'a', 'b', 'c', 'limner.db');
    expect(existsSync(join(base, 'a'))).toBe(false);

    const first = createLocalBindings({ dbPath, schemaPath: SCHEMA_PATH });
    expect(existsSync(dbPath)).toBe(true);
    first.db
      .prepare(
        'INSERT INTO memory_entries (id, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run('01TESTULID0000000000000000', 'first-run row', 1, 1);
    first.db.close();

    // Reopen on the same path — schema reapply is IF NOT EXISTS-idempotent
    // and the previously written row must survive.
    const second = createLocalBindings({ dbPath, schemaPath: SCHEMA_PATH });
    const row = second.db
      .prepare('SELECT content FROM memory_entries WHERE id = ?')
      .get('01TESTULID0000000000000000') as { content: string } | undefined;
    expect(row?.content).toBe('first-run row');
    second.db.close();
  });
});

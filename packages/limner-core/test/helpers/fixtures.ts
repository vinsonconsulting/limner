import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { D1Database } from '@cloudflare/workers-types';
import { Miniflare } from 'miniflare';

import type { Bindings } from '../../src/bindings/index.js';
import { createLocalBindings } from '../../src/bindings/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolves to <repo-root>/migrations/0001_initial_schema.sql.
// test/helpers/fixtures.ts -> test/helpers -> test -> limner-core -> packages -> root
export const SCHEMA_PATH = resolve(__dirname, '../../../../migrations/0001_initial_schema.sql');

export const loadSchema = (): string => readFileSync(SCHEMA_PATH, 'utf8');

export interface Fixture {
  bindings: Bindings;
  dispose: () => Promise<void>;
}

// ---------------- Local (better-sqlite3, in-memory) ----------------

export async function makeLocalFixture(): Promise<Fixture> {
  const bindings = createLocalBindings({ schemaPath: SCHEMA_PATH });
  return {
    bindings,
    dispose: async () => {
      if (bindings.kind === 'local') bindings.db.close();
    },
  };
}

// ---------------- D1 (miniflare-emulated, in-node) ----------------

// Splits the multi-statement schema and applies it via D1's prepare/run,
// since D1's bulk-SQL runner requires single-line statements. PRAGMAs are
// skipped -- D1 does not expose them and foreign_keys is on by default.
async function applySchemaToD1(db: D1Database, sql: string): Promise<void> {
  const statements = sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toUpperCase().startsWith('PRAGMA'));
  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}

export async function makeD1Fixture(): Promise<Fixture> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch: () => new Response("ok") };',
    d1Databases: ['DB'],
  });
  // miniflare's D1Database is structurally compatible with workers-types
  // but uses a different nominal identity, so coerce through unknown.
  const d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
  await applySchemaToD1(d1, loadSchema());
  return {
    bindings: { kind: 'workers', DB: d1 },
    dispose: () => mf.dispose(),
  };
}

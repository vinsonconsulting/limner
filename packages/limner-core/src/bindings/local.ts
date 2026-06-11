import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Bindings shape when running outside a Worker — stdio MCP mode, local tests,
// CLI usage. Backed by node:sqlite (built into Node >= 22.13) + filesystem.
export type LocalBindings = {
  kind: 'local';
  db: DatabaseSync;
  artifactsDir?: string;
};

export type LocalBindingsOptions = {
  // ':memory:' (default) or a filesystem path.
  dbPath?: string;
  artifactsDir?: string;
  // One of schemaSql or schemaPath should be provided to apply migrations
  // at startup. If neither is provided, the caller is responsible for
  // applying schema separately.
  schemaSql?: string;
  schemaPath?: string;
};

// Apply the multi-statement schema blob atomically. DatabaseSync.exec()
// handles multiple statements and comments natively; node:sqlite has no
// transaction helper, so the wrapper is manual. The schema's own
// `PRAGMA foreign_keys = ON` is a silent no-op inside the transaction —
// enforcement comes from the constructor option instead.
function applySchema(db: DatabaseSync, sql: string): void {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(sql);
    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // BEGIN itself failed — nothing to roll back.
    }
    throw err;
  }
}

export function createLocalBindings(opts: LocalBindingsOptions = {}): LocalBindings {
  // SQLite can create a missing db file but not a missing parent directory.
  // Guard here at the core seam so the stdio default (~/.limner/limner.db
  // on a fresh install), env overrides, and npm consumers all get a working
  // first run. dirname of a bare filename is '.', which recursive mkdir
  // treats as a no-op.
  if (opts.dbPath && opts.dbPath !== ':memory:') {
    mkdirSync(dirname(opts.dbPath), { recursive: true });
  }
  const db = new DatabaseSync(opts.dbPath ?? ':memory:', {
    enableForeignKeyConstraints: true,
  });
  db.exec('PRAGMA journal_mode = WAL');

  const schema = opts.schemaSql
    ?? (opts.schemaPath ? readFileSync(opts.schemaPath, 'utf8') : null);
  if (schema) {
    applySchema(db, schema);
  }

  return {
    kind: 'local',
    db,
    artifactsDir: opts.artifactsDir,
  };
}

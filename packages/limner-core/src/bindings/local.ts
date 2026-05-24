import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';

// Bindings shape when running outside a Worker — stdio MCP mode, local tests,
// CLI usage. Backed by better-sqlite3 + filesystem.
export type LocalBindings = {
  kind: 'local';
  db: Database.Database;
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

// Split a multi-statement SQL blob into individual statements. Strips line
// comments and trims whitespace. Assumes ';' is only a statement terminator
// (true for our DDL — string literals containing ';' are not used).
function splitSqlStatements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function applySchema(db: Database.Database, sql: string): void {
  const statements = splitSqlStatements(sql);
  const tx = db.transaction(() => {
    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('PRAGMA')) {
        // PRAGMA statements go through .pragma() (better-sqlite3 convention).
        db.pragma(stmt.slice('PRAGMA'.length).trim());
      } else {
        db.prepare(stmt).run();
      }
    }
  });
  tx();
}

export function createLocalBindings(opts: LocalBindingsOptions = {}): LocalBindings {
  const db = new Database(opts.dbPath ?? ':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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

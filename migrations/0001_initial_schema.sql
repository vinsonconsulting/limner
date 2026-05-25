-- Limner @limner/core initial schema (Phase 1).
--
-- Applies to both D1 (via `wrangler d1 migrations apply`) and the local
-- better-sqlite3 store (read + execute at LocalBindings factory startup).
-- Keep this file plain SQLite-compatible — no D1-only or SQLite-only syntax.
--
-- Reference: docs/Limner_Cloudflare_CMA_Architecture.md §3.3, §6, §12.

PRAGMA foreign_keys = ON;

----------------------------------------------------------------------
-- memory_entries
--
-- The durable memory store for Limner. ULIDs as primary keys
-- (lexicographic + time-ordered, URL-safe). `source_id` is the
-- idempotency key for the Phase 6 CMA-memory backfill migration —
-- re-running the import upserts on this column. `metadata` is a JSON
-- TEXT blob; search inside metadata requires json_extract().
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memory_entries (
  id          TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  category    TEXT,
  source_id   TEXT UNIQUE,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  metadata    TEXT
);

CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_entries(category);
CREATE INDEX IF NOT EXISTS idx_memory_created  ON memory_entries(created_at);

----------------------------------------------------------------------
-- projects
--
-- Named project context for the project tools (Phase 4 surfaces these
-- via list_projects / get_project_context / record_project_note).
-- `name` is UNIQUE so callers can look up by human-readable handle.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  metadata    TEXT
);

----------------------------------------------------------------------
-- project_notes
--
-- Append-only notes attached to a project. CASCADE on project delete
-- because notes have no meaning without their project.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_notes (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  metadata   TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_project ON project_notes(project_id);

----------------------------------------------------------------------
-- sessions
--
-- Per-CMA-session record. project_id is nullable because sessions can
-- exist without project context (ad-hoc generation). SET NULL on
-- project delete preserves the session record for audit.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  ended_at   INTEGER,
  metadata   TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);

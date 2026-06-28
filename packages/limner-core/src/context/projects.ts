import type { D1Database } from '@cloudflare/workers-types';
import type { DatabaseSync } from 'node:sqlite';
import { ulid } from 'ulid';

import type {
  Project,
  ProjectCreateInput,
  ProjectNote,
  ProjectNoteInput,
  ProjectQuery,
  ProjectUpdateInput,
} from '../types.js';

export interface ProjectStore {
  create(input: ProjectCreateInput): Promise<Project>;
  get(id: string): Promise<Project | null>;
  getByName(name: string): Promise<Project | null>;
  list(query?: ProjectQuery): Promise<Project[]>;
  update(id: string, patch: ProjectUpdateInput): Promise<Project | null>;
  delete(id: string): Promise<boolean>;
  addNote(input: ProjectNoteInput): Promise<ProjectNote>;
  listNotes(projectId: string, opts?: { limit?: number; offset?: number }): Promise<ProjectNote[]>;
}

// ---------------- Shared row shapes and mappers ----------------

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  metadata: string | null;
};

type NoteRow = {
  id: string;
  project_id: string;
  content: string;
  created_at: number;
  metadata: string | null;
};

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
  };
}

function noteFromRow(row: NoteRow): ProjectNote {
  return {
    id: row.id,
    projectId: row.project_id,
    content: row.content,
    createdAt: row.created_at,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
  };
}

// A clean, actionable error for a note targeting an unknown project — replaces
// the raw D1_ERROR foreign-key violation the INSERT would otherwise throw (F5).
function projectNotFound(projectId: string): Error {
  return new Error(`project not found: ${projectId} — create it first with limner_create_project`);
}

// ---------------- D1 backend ----------------

export class D1ProjectStore implements ProjectStore {
  constructor(private readonly db: D1Database) {}

  async create(input: ProjectCreateInput): Promise<Project> {
    const id = ulid();
    const now = Date.now();
    await this.db.prepare(
      'INSERT INTO projects (id, name, description, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(
      id,
      input.name,
      input.description ?? null,
      now,
      now,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ).run();
    const row = await this.db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>();
    if (!row) throw new Error('create: failed to read back inserted project');
    return projectFromRow(row);
  }

  async get(id: string): Promise<Project | null> {
    const row = await this.db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>();
    return row ? projectFromRow(row) : null;
  }

  async getByName(name: string): Promise<Project | null> {
    const row = await this.db.prepare('SELECT * FROM projects WHERE name = ?').bind(name).first<ProjectRow>();
    return row ? projectFromRow(row) : null;
  }

  async list(query: ProjectQuery = {}): Promise<Project[]> {
    const where: string[] = [];
    const binds: (string | number)[] = [];
    if (query.q) {
      where.push('(name LIKE ? OR description LIKE ?)');
      binds.push(`%${query.q}%`, `%${query.q}%`);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const { results } = await this.db
      .prepare(`SELECT * FROM projects ${whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
      .bind(...binds, limit, offset)
      .all<ProjectRow>();
    return results.map(projectFromRow);
  }

  async update(id: string, patch: ProjectUpdateInput): Promise<Project | null> {
    const sets: string[] = ['updated_at = ?'];
    const binds: (string | number | null)[] = [Date.now()];
    if (patch.description !== undefined) {
      sets.push('description = ?');
      binds.push(patch.description);
    }
    if (patch.metadata !== undefined) {
      sets.push('metadata = ?');
      binds.push(JSON.stringify(patch.metadata));
    }
    binds.push(id);
    await this.db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    return this.get(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
    return (result.meta.changes ?? 0) > 0;
  }

  async addNote(input: ProjectNoteInput): Promise<ProjectNote> {
    // Guard the FK before inserting: an unknown project_id would otherwise
    // surface the raw D1_ERROR foreign-key violation to the caller. A clean,
    // actionable message is returned instead (F5).
    if (!(await this.get(input.projectId))) throw projectNotFound(input.projectId);
    const id = ulid();
    const now = Date.now();
    await this.db.prepare(
      'INSERT INTO project_notes (id, project_id, content, created_at, metadata) VALUES (?, ?, ?, ?, ?)',
    ).bind(
      id,
      input.projectId,
      input.content,
      now,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ).run();
    const row = await this.db.prepare('SELECT * FROM project_notes WHERE id = ?').bind(id).first<NoteRow>();
    if (!row) throw new Error('addNote: failed to read back inserted note');
    return noteFromRow(row);
  }

  async listNotes(projectId: string, opts: { limit?: number; offset?: number } = {}): Promise<ProjectNote[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM project_notes WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(projectId, opts.limit ?? 100, opts.offset ?? 0)
      .all<NoteRow>();
    return results.map(noteFromRow);
  }
}

// ---------------- Local (node:sqlite) backend ----------------

export class LocalProjectStore implements ProjectStore {
  constructor(private readonly db: DatabaseSync) {}

  async create(input: ProjectCreateInput): Promise<Project> {
    const id = ulid();
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO projects (id, name, description, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      input.name,
      input.description ?? null,
      now,
      now,
      input.metadata ? JSON.stringify(input.metadata) : null,
    );
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    if (!row) throw new Error('create: failed to read back inserted project');
    return projectFromRow(row);
  }

  async get(id: string): Promise<Project | null> {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    return row ? projectFromRow(row) : null;
  }

  async getByName(name: string): Promise<Project | null> {
    const row = this.db.prepare('SELECT * FROM projects WHERE name = ?').get(name) as ProjectRow | undefined;
    return row ? projectFromRow(row) : null;
  }

  async list(query: ProjectQuery = {}): Promise<Project[]> {
    const where: string[] = [];
    const binds: (string | number)[] = [];
    if (query.q) {
      where.push('(name LIKE ? OR description LIKE ?)');
      binds.push(`%${query.q}%`, `%${query.q}%`);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const rows = this.db
      .prepare(`SELECT * FROM projects ${whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
      .all(...binds, limit, offset) as ProjectRow[];
    return rows.map(projectFromRow);
  }

  async update(id: string, patch: ProjectUpdateInput): Promise<Project | null> {
    const sets: string[] = ['updated_at = ?'];
    const binds: (string | number | null)[] = [Date.now()];
    if (patch.description !== undefined) {
      sets.push('description = ?');
      binds.push(patch.description);
    }
    if (patch.metadata !== undefined) {
      sets.push('metadata = ?');
      binds.push(JSON.stringify(patch.metadata));
    }
    binds.push(id);
    this.db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...binds);
    return this.get(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async addNote(input: ProjectNoteInput): Promise<ProjectNote> {
    // Guard the FK before inserting (F5) — same contract as the D1 backend.
    if (!(await this.get(input.projectId))) throw projectNotFound(input.projectId);
    const id = ulid();
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO project_notes (id, project_id, content, created_at, metadata) VALUES (?, ?, ?, ?, ?)',
    ).run(
      id,
      input.projectId,
      input.content,
      now,
      input.metadata ? JSON.stringify(input.metadata) : null,
    );
    const row = this.db.prepare('SELECT * FROM project_notes WHERE id = ?').get(id) as NoteRow | undefined;
    if (!row) throw new Error('addNote: failed to read back inserted note');
    return noteFromRow(row);
  }

  async listNotes(projectId: string, opts: { limit?: number; offset?: number } = {}): Promise<ProjectNote[]> {
    const rows = this.db
      .prepare('SELECT * FROM project_notes WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(projectId, opts.limit ?? 100, opts.offset ?? 0) as NoteRow[];
    return rows.map(noteFromRow);
  }
}

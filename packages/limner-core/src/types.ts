// Domain types for Limner. Kept minimal in Phase 1; evolves with retrieval
// and tool-surface requirements in later phases.

// ---------------- Pipelines (D-RA-14 distinction) ----------------

export interface Pipeline {
  readonly id: string;
  readonly displayName: string;
}

export interface ApiBackedPipeline extends Pipeline {
  readonly kind: 'api';
}

export interface ComposedMcpPipeline extends Pipeline {
  readonly kind: 'mcp-adapter';
  readonly transport: 'remote-http' | 'local-stdio';
}

export type AnyPipeline = ApiBackedPipeline | ComposedMcpPipeline;

// ---------------- Memory ----------------

export type MemoryEntry = {
  id: string;
  content: string;
  category?: string;
  sourceId?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
};

export type MemoryRecordInput = {
  content: string;
  category?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
};

export type MemoryQuery = {
  q?: string;
  category?: string;
  limit?: number;
  offset?: number;
  since?: number;
  until?: number;
};

export type CategoryCount = {
  category: string;
  count: number;
};

// ---------------- Projects ----------------

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
};

export type ProjectNote = {
  id: string;
  projectId: string;
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
};

export type ProjectCreateInput = {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type ProjectUpdateInput = {
  /** `null` clears the stored description; omit (undefined) to leave it
   *  unchanged. Both store impls bind `null` as SQL NULL (A6). */
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export type ProjectNoteInput = {
  projectId: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type ProjectQuery = {
  q?: string;
  limit?: number;
  offset?: number;
};

// ---------------- Sessions ----------------

export type Session = {
  id: string;
  projectId?: string;
  startedAt: number;
  endedAt?: number;
  metadata?: Record<string, unknown>;
};

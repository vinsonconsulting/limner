// Guidance entry model (D-RA-24). A GuidanceEntry is pure data — a small
// structured block list — paired with a single serializer (serialize.ts) so
// the MCP prompt/resource surfaces (runtime) and the CMA skill generator
// (build time) all render from one source and cannot drift.

/** A renderable block within a guidance entry's body. */
export type GuidanceBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'bullets'; items: readonly string[] }
  | { kind: 'table'; columns: readonly string[]; rows: readonly (readonly string[])[] };

/** One unit of guidance, keyed by a stable id. */
export interface GuidanceEntry {
  /** Stable lookup key, e.g. 'file-types'. */
  readonly id: string;
  /** Human-facing title; rendered as the top-level heading. */
  readonly title: string;
  /** One-line summary; reused as the MCP resource/prompt description. */
  readonly summary: string;
  /** Ordered renderable blocks. */
  readonly body: readonly GuidanceBlock[];
}

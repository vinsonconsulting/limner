// Pure skill-generation helpers (D-RA-24). No node:fs — the splice logic and
// the guidance-derived block are shared by the generator (src/gen-skills.ts,
// which adds the I/O) and the drift-check test, so both produce identical
// output and SKILL.md can never drift from the @limner/core guidance source.

import { getGuidance, serializeGuidance } from '@limner/core';

export const SKILL_MARKER_BEGIN = '<!-- BEGIN GENERATED: file-types -->';
export const SKILL_MARKER_END = '<!-- END GENERATED -->';

/**
 * The guidance-derived block injected into the file-types SKILL.md. Serializes
 * the single `file-types` guidance entry — the same source the MCP
 * `limner://reference/file-types` resource reads at runtime.
 */
export function generatedBlock(): string {
  return serializeGuidance(getGuidance('file-types')!);
}

/**
 * Replace the content between the generation markers in `existing` with
 * `block`, preserving everything outside the markers verbatim. The inner
 * region becomes exactly `\n${block}\n`. Throws if the markers are missing or
 * out of order.
 */
export function spliceGenerated(existing: string, block: string): string {
  const begin = existing.indexOf(SKILL_MARKER_BEGIN);
  const end = existing.indexOf(SKILL_MARKER_END);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `SKILL.md is missing the generation markers (${SKILL_MARKER_BEGIN} ... ${SKILL_MARKER_END})`,
    );
  }
  const head = existing.slice(0, begin + SKILL_MARKER_BEGIN.length);
  const tail = existing.slice(end);
  return `${head}\n${block}\n${tail}`;
}

/**
 * Extract the current content between the generation markers, trimmed of the
 * surrounding newlines. The inverse of the splice's inner region; used by the
 * drift-check to compare committed vs freshly-generated content.
 */
export function extractGenerated(existing: string): string {
  const begin = existing.indexOf(SKILL_MARKER_BEGIN);
  const end = existing.indexOf(SKILL_MARKER_END);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error('SKILL.md is missing the generation markers');
  }
  return existing.slice(begin + SKILL_MARKER_BEGIN.length, end).trim();
}

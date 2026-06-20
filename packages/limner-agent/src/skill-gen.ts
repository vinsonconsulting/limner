// Pure skill-generation helpers (D-RA-24). No node:fs: the splice logic and the
// guidance-derived block are shared by the generator (src/gen-skills.ts, which
// adds the I/O) and the drift-check test, so both produce identical output and
// each SKILL.md can never drift from its @limner/core guidance source.
//
// The machinery is data-driven over SKILL_SOURCES, so adding a skill with a
// generated reference region is a manifest row plus a SKILL.md carrying the
// matching markers. One generated region per (file, guidance id).

import { getGuidance, serializeGuidance } from '@limner/core';

/** One generated skill: its directory under skills/ and the guidance id it renders. */
export type SkillSource = {
  /** Directory name under packages/limner-agent/skills/. */
  readonly skillDir: string;
  /** Guidance entry id serialized into the skill's generated region. */
  readonly guidanceId: string;
};

/**
 * Every skill with a guidance-derived generated region, in file order. A purely
 * procedural skill (no generated block) is simply absent from this list.
 * gen:skills and the drift-check both iterate it.
 */
export const SKILL_SOURCES: readonly SkillSource[] = [
  { skillDir: 'file-types', guidanceId: 'file-types' },
  { skillDir: 'external-tools', guidanceId: 'external-tools' },
  { skillDir: 'midjourney', guidanceId: 'midjourney-recipe' },
  { skillDir: 'dalle', guidanceId: 'dalle-recipe' },
  { skillDir: 'recraft', guidanceId: 'recraft-recipe' },
  { skillDir: 'illuminated-manuscript', guidanceId: 'illuminated-manuscript' },
  { skillDir: 'pipeline-router', guidanceId: 'pipeline-router' },
  { skillDir: 'brand-stamp', guidanceId: 'brand-stamp' },
  { skillDir: 'multi-size-export', guidanceId: 'multi-size-export' },
  { skillDir: 'captioned-graphic', guidanceId: 'captioned-graphic' },
];

export const SKILL_MARKER_END = '<!-- END GENERATED -->';

/** The opening marker for a skill's generated region, namespaced by guidance id. */
export function markerBegin(guidanceId: string): string {
  return `<!-- BEGIN GENERATED: ${guidanceId} -->`;
}

/**
 * The guidance-derived block injected into a skill's SKILL.md. Serializes the
 * named guidance entry, the same source the matching MCP resource/prompt reads
 * at runtime. Throws if the id is unknown.
 */
export function generatedBlock(guidanceId: string): string {
  const entry = getGuidance(guidanceId);
  if (!entry) {
    throw new Error(`gen:skills: no guidance entry "${guidanceId}"`);
  }
  return serializeGuidance(entry);
}

/**
 * Replace the content between the generation markers for `guidanceId` in
 * `existing` with `block`, preserving everything outside the markers verbatim.
 * The inner region becomes exactly `\n${block}\n`. The END marker is searched
 * from the BEGIN position so multiple regions in one file stay independent.
 * Throws if the markers are missing or out of order.
 */
export function spliceGenerated(existing: string, block: string, guidanceId: string): string {
  const beginMarker = markerBegin(guidanceId);
  const begin = existing.indexOf(beginMarker);
  const end = begin === -1 ? -1 : existing.indexOf(SKILL_MARKER_END, begin);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `SKILL.md is missing the generation markers (${beginMarker} ... ${SKILL_MARKER_END})`,
    );
  }
  const head = existing.slice(0, begin + beginMarker.length);
  const tail = existing.slice(end);
  return `${head}\n${block}\n${tail}`;
}

/**
 * Extract the current content between the generation markers for `guidanceId`,
 * trimmed of the surrounding newlines. The inverse of the splice's inner region;
 * used by the drift-check to compare committed vs freshly-generated content.
 */
export function extractGenerated(existing: string, guidanceId: string): string {
  const beginMarker = markerBegin(guidanceId);
  const begin = existing.indexOf(beginMarker);
  const end = begin === -1 ? -1 : existing.indexOf(SKILL_MARKER_END, begin);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(`SKILL.md is missing the generation markers (${beginMarker})`);
  }
  return existing.slice(begin + beginMarker.length, end).trim();
}

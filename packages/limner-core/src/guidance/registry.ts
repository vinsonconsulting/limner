import type { GuidanceEntry } from './types.js';
import { fileTypes } from './entries/file-types.js';
import { capabilitiesOverview } from './entries/capabilities-overview.js';

// Registration order is the public listing order. Wave-1 authoring (the
// remaining D-RA-24 concepts) appends entries here.
const ENTRIES: readonly GuidanceEntry[] = [fileTypes, capabilitiesOverview];

/** All guidance entries keyed by id. */
export const guidanceRegistry: ReadonlyMap<string, GuidanceEntry> = new Map(
  ENTRIES.map((entry) => [entry.id, entry]),
);

/** Look up a guidance entry by id; undefined if absent. */
export function getGuidance(id: string): GuidanceEntry | undefined {
  return guidanceRegistry.get(id);
}

/** All guidance entries, in registration order. */
export function listGuidance(): readonly GuidanceEntry[] {
  return ENTRIES;
}

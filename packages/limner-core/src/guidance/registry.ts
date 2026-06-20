import type { GuidanceEntry } from './types.js';
import { fileTypes } from './entries/file-types.js';
import { capabilitiesOverview } from './entries/capabilities-overview.js';
import { externalTools } from './entries/external-tools.js';
import { midjourneyRecipe } from './entries/midjourney-recipe.js';
import { dalleRecipe } from './entries/dalle-recipe.js';
import { recraftRecipe } from './entries/recraft-recipe.js';
import { styleProfile } from './entries/style-profile.js';
import { illuminatedManuscript } from './entries/illuminated-manuscript.js';
import { pipelineRouter } from './entries/pipeline-router.js';
import { brandStamp } from './entries/brand-stamp.js';
import { multiSizeExport } from './entries/multi-size-export.js';
import { captionedGraphic } from './entries/captioned-graphic.js';

// Registration order is the public listing order. D-RA-24 concept authoring
// (wave-1, then wave-2) appends entries here.
const ENTRIES: readonly GuidanceEntry[] = [
  fileTypes,
  capabilitiesOverview,
  externalTools,
  midjourneyRecipe,
  dalleRecipe,
  recraftRecipe,
  styleProfile,
  illuminatedManuscript,
  pipelineRouter,
  brandStamp,
  multiSizeExport,
  captionedGraphic,
];

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

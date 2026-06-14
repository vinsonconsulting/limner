import type { ProjectStore } from '../context/projects.js';
import {
  STYLE_PROFILE_KEY,
  StyleProfileSchema,
  parseStyleProfile,
  type StyleProfile,
  type StyleProfileInput,
  type StyleProfilePatch,
} from './schema.js';

/**
 * Read/merge/write helpers for the style profile (D-RA-24). The profile lives
 * under `Project.metadata[STYLE_PROFILE_KEY]`; there is no dedicated table and
 * no new tool surface — these helpers compose the existing ProjectStore.
 *
 * ProjectStore.update() REPLACES the whole metadata column, so every write here
 * is read-modify-write: we re-read the project, splice the profile into its
 * metadata, and write the whole blob back, preserving sibling keys.
 */

/**
 * Read the style profile for a project. Returns null when the project or the
 * profile is absent. Throws (via Zod) when a profile IS present but invalid —
 * corruption surfaces rather than silently vanishing.
 */
export async function readStyleProfile(
  store: ProjectStore,
  projectId: string,
): Promise<StyleProfile | null> {
  const project = await store.get(projectId);
  if (!project) return null;
  const raw = project.metadata?.[STYLE_PROFILE_KEY];
  if (raw === undefined) return null;
  return parseStyleProfile(raw);
}

/**
 * Merge a patch over a base profile (pure). Top-level fields present in the
 * patch override the base; arrays and nested objects are replaced wholesale,
 * not deep-merged. The result is re-validated.
 */
export function mergeStyleProfile(
  base: StyleProfile,
  patch: StyleProfilePatch,
): StyleProfile {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) merged[key] = value;
  }
  return StyleProfileSchema.parse(merged);
}

/**
 * Validate `profile` and write it onto the project's metadata, preserving every
 * other metadata key. Throws if the project does not exist. Returns the stored
 * (validated) profile.
 */
export async function writeStyleProfile(
  store: ProjectStore,
  projectId: string,
  profile: StyleProfileInput,
): Promise<StyleProfile> {
  const project = await store.get(projectId);
  if (!project) {
    throw new Error(`writeStyleProfile: project not found: ${projectId}`);
  }
  const validated = StyleProfileSchema.parse(profile);
  const metadata = { ...(project.metadata ?? {}), [STYLE_PROFILE_KEY]: validated };
  await store.update(projectId, { metadata });
  return validated;
}

/**
 * The canonical read/merge/write cycle: read the current profile (or start from
 * an empty `{ version: 1 }`), merge the patch, and persist. Returns the new
 * stored profile.
 */
export async function upsertStyleProfile(
  store: ProjectStore,
  projectId: string,
  patch: StyleProfilePatch,
): Promise<StyleProfile> {
  const current = (await readStyleProfile(store, projectId)) ?? StyleProfileSchema.parse({});
  const next = mergeStyleProfile(current, patch);
  return writeStyleProfile(store, projectId, next);
}

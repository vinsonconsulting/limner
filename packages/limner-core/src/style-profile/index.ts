// Style profile (D-RA-24). Cross-cutting schema + read/merge/write helpers
// shared by the brand-kit (#9), style-from-images (#15), and art-research (#17)
// surfaces. Persisted on project metadata via the existing ProjectStore — no
// dedicated table, no new tool surface.

export {
  STYLE_PROFILE_KEY,
  StyleProfileSchema,
  parseStyleProfile,
} from './schema.js';
export type {
  StyleProfile,
  StyleProfileInput,
  StyleProfilePatch,
} from './schema.js';

export {
  readStyleProfile,
  mergeStyleProfile,
  writeStyleProfile,
  upsertStyleProfile,
} from './store.js';

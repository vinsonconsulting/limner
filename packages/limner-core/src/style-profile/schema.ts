import { z } from 'zod';

/**
 * Style profile (D-RA-24) — the single cross-cutting artifact that the brand-kit
 * (#9), style-from-images (#15), and art-research (#17) surfaces all read and
 * write. They share ONE shape so a profile authored by one is consumable by the
 * others. The shape is persisted on a project's metadata (see store.ts); this
 * module is the schema + types only.
 *
 * Limner is an independent third-party project on Anthropic's CMA platform.
 */

/** Reserved key under `Project.metadata` where the style profile is stored. */
export const STYLE_PROFILE_KEY = 'styleProfile';

/** Hex color, 3/6/8 digits with a leading '#'. */
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'must be a hex color like #1a2b3c');

const paletteEntry = z.object({
  hex: hexColor,
  name: z.string().optional(),
});

const reference = z.object({
  /** A URL, asset id, or memory/project id pointing at an exemplar. */
  ref: z.string().min(1),
  kind: z.enum(['image', 'url', 'memory', 'note']).optional(),
  note: z.string().optional(),
});

const pipelinePrefs = z.object({
  /** Which generation pipeline this profile favors. */
  preferred: z.enum(['midjourney', 'dalle', 'recraft']).optional(),
  /** Default Recraft knobs (mirror RecraftOptions). */
  recraft: z
    .object({
      style: z
        .enum(['digital_illustration', 'vector_illustration', 'realistic_image'])
        .optional(),
      substyle: z.string().optional(),
    })
    .optional(),
  /** Default Midjourney knobs (mirror MidjourneyOptions). */
  midjourney: z
    .object({
      style: z.string().optional(),
      stylize: z.number().int().min(0).max(1000).optional(),
    })
    .optional(),
});

const provenance = z.object({
  /** Which surface produced this profile. */
  source: z.enum(['brand-kit', 'style-from-images', 'art-research', 'manual']),
  note: z.string().optional(),
  /** Unix epoch (ms) the profile was last set. */
  updatedAt: z.number().int().optional(),
});

/**
 * The validated style-profile shape. Every field is optional except the schema
 * `version` tag (which defaults to 1) so an "empty" profile parses cleanly and
 * partial authoring is supported.
 */
export const StyleProfileSchema = z.object({
  /** Schema version tag for forward migration. */
  version: z.literal(1).default(1),
  /** Named/unnamed brand or art colors. */
  palette: z.array(paletteEntry).optional(),
  /** Free-form style keywords ("cinematic", "flat", "noir"). */
  descriptors: z.array(z.string()).optional(),
  /** Medium / technique notes ("watercolor wash", "isometric vector"). */
  medium: z.string().optional(),
  /** Preferred pipeline + per-pipeline knob defaults. */
  pipelinePrefs: pipelinePrefs.optional(),
  /** Exemplar / reference asset pointers. */
  references: z.array(reference).optional(),
  /** Where the profile came from + when. */
  provenance: provenance.optional(),
});

/** Stored shape — `version` is always present. */
export type StyleProfile = z.infer<typeof StyleProfileSchema>;
/** Authoring shape — `version` may be omitted (defaults to 1). */
export type StyleProfileInput = z.input<typeof StyleProfileSchema>;
/** A partial update applied over an existing profile by mergeStyleProfile. */
export type StyleProfilePatch = Partial<StyleProfileInput>;

/**
 * Validate an untrusted value as a StyleProfile. Throws a ZodError on failure.
 * Use on data read from storage or supplied by a caller.
 */
export function parseStyleProfile(raw: unknown): StyleProfile {
  return StyleProfileSchema.parse(raw);
}

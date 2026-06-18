// Built-in renderText fonts. Bundled server-side and embedded as base64
// (fonts.generated.ts) so compose resolves them by id — the MCP tool no
// longer transits font bytes inline. A large base64 font truncates on the
// MCP wire and corrupts the WASM DataView (the compose font-truncation bug);
// resolving by id keeps the bytes server-side. User-supplied fonts, if ever
// needed, should load by reference (R2/URL), not inline.

import { base64ToBytes } from '../base64.js';
import { IBM_PLEX_SANS_REGULAR_B64 } from '../fonts.generated.js';

export type FontId = 'ibm-plex-sans';

export const DEFAULT_FONT_ID: FontId = 'ibm-plex-sans';

type FontEntry = { name: string; b64: string };

const REGISTRY: Record<FontId, FontEntry> = {
  'ibm-plex-sans': { name: 'IBM Plex Sans', b64: IBM_PLEX_SANS_REGULAR_B64 },
};

// Decode-on-first-use; the Uint8Array is cached so repeat renders skip the
// base64 decode of a ~196 KB font.
const cache = new Map<FontId, Uint8Array>();

export function isFontId(id: string): id is FontId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, id);
}

export function listFontIds(): FontId[] {
  return Object.keys(REGISTRY) as FontId[];
}

export function fontDisplayName(id: FontId): string {
  return REGISTRY[id].name;
}

export function resolveFontBytes(id: FontId): Uint8Array {
  const cached = cache.get(id);
  if (cached) return cached;
  const bytes = base64ToBytes(REGISTRY[id].b64);
  cache.set(id, bytes);
  return bytes;
}

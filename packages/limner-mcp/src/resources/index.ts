// MCP resources registry (D-RA-24). Sibling to tools/: each resource derives
// its content from the @limner/core guidance source, so resource text cannot
// drift from the guidance entry. registerResources installs resources/list +
// resources/read on a Server; both transports call it alongside registerTools.
//
// The `resources` capability is declared in createServer (server.ts) — without
// it the SDK client refuses resources/* calls (assertCapabilityForMethod).
//
// Refs: D-RA-24

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getGuidance, serializeGuidance } from '@limner/core';

export type Resource = {
  /** Stable resource URI advertised in resources/list. */
  uri: string;
  /** Short machine name (required by the MCP list shape). */
  name: string;
  /** One-line description for resources/list. */
  description: string;
  /** MIME type of the read payload. */
  mimeType: string;
  /** Produce the resource body. Derives from a guidance entry. */
  read: () => string;
};

// limner://reference/file-types — concept #14, serialized from the single
// guidance entry shared with the CMA file-types skill (the anti-drift proof:
// this resource and that skill render from one source).
const fileTypesResource: Resource = {
  uri: 'limner://reference/file-types',
  name: 'file-types',
  description: getGuidance('file-types')!.summary,
  mimeType: 'text/markdown',
  read: () => serializeGuidance(getGuidance('file-types')!),
};

// limner://reference/external-tools (concept #16): serialized from the
// external-tools guidance entry, the same source the CMA external-tools skill
// renders, so resource and skill cannot drift.
const externalToolsResource: Resource = {
  uri: 'limner://reference/external-tools',
  name: 'external-tools',
  description: getGuidance('external-tools')!.summary,
  mimeType: 'text/markdown',
  read: () => serializeGuidance(getGuidance('external-tools')!),
};

// limner://reference/print-ready (concept #12): serialized from the print-ready
// guidance entry, the same source the CMA print-ready skill renders, so resource
// and skill cannot drift. The reference half of a reference-plus-handoff concept.
const printReadyResource: Resource = {
  uri: 'limner://reference/print-ready',
  name: 'print-ready',
  description: getGuidance('print-ready')!.summary,
  mimeType: 'text/markdown',
  read: () => serializeGuidance(getGuidance('print-ready')!),
};

export const resources: readonly Resource[] = [
  fileTypesResource,
  externalToolsResource,
  printReadyResource,
];

/**
 * Wire resource definitions into a Server. Installs two handlers:
 *   - resources/list -> enumerates uri/name/description/mimeType
 *   - resources/read -> serializes the matching resource's guidance content
 *
 * No ToolContext: guidance is pure data with no per-request binding access,
 * so this intentionally takes a narrower signature than registerTools.
 */
export function registerResources(server: Server, list: readonly Resource[]): void {
  const byUri = new Map<string, Resource>(list.map((r) => [r.uri, r]));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: list.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const resource = byUri.get(req.params.uri);
    if (!resource) {
      throw new Error(`resource not found: ${req.params.uri}`);
    }
    return {
      contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.read() }],
    };
  });
}

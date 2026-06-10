// Real McpRecraftTransport — fulfills the RecraftTransport contract
// from @limner/core via @modelcontextprotocol/sdk Client. Two modes:
//
//   - 'remote': mcp.recraft.ai/mcp (StreamableHTTPClientTransport,
//               Authorization: Bearer <RECRAFT_API_KEY>)
//   - 'local':  npx -y @recraft-ai/mcp-recraft-server@latest
//               (StdioClientTransport)
//
// Recraft's MCP server exposes nine tools (confirmed against
// github.com/recraft-ai/mcp-recraft-server README, 2026-05-25). This
// adapter wires `generate_image` only — the rasa-relevant surface per
// the architecture's `limner_generate_recraft` tool spec. Additional Recraft
// tools (vectorize_image, remove_background, etc.) can be exposed as
// a "recraft passthrough" surface in a later phase if demand surfaces.
//
// Refs: D-RA-14

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  base64ToBytes,
  type RecraftMode,
  type RecraftTransport,
  type RecraftGenerateArgs,
  type RecraftGenerateResult,
} from '@limner/core';

import { VERSION } from '../version.js';

const REMOTE_URL = 'https://mcp.recraft.ai/mcp';
const LOCAL_COMMAND = 'npx';
const LOCAL_ARGS = ['-y', '@recraft-ai/mcp-recraft-server@latest'];
const RECRAFT_TOOL_NAME = 'generate_image';

export class McpRecraftTransport implements RecraftTransport {
  private constructor(private readonly client: Client) {}

  /**
   * Open a connection to Recraft's MCP server.
   *
   * @param mode 'remote' for mcp.recraft.ai (requires `secrets.RECRAFT_API_KEY`)
   *             or 'local' for the stdio server binary.
   * @param secrets RECRAFT_API_KEY required for remote mode; passed into the
   *                child process env for local mode (the local server reads
   *                it from `process.env.RECRAFT_API_KEY`).
   */
  static async connect(
    mode: RecraftMode,
    secrets: Readonly<Record<string, string>>,
  ): Promise<McpRecraftTransport> {
    // VERSION is the A7 single-source constant (sync-version.mjs) — a
    // hardcoded literal here silently drifts on every release.
    const client = new Client(
      { name: 'limner-mcp', version: VERSION },
      { capabilities: {} },
    );

    if (mode === 'remote') {
      const apiKey = secrets['RECRAFT_API_KEY'];
      if (!apiKey) {
        throw new Error('McpRecraftTransport(remote): RECRAFT_API_KEY required');
      }
      await client.connect(
        new StreamableHTTPClientTransport(new URL(REMOTE_URL), {
          requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
        }),
      );
    } else {
      // Local mode: spawn the npm-published stdio server. The package
      // reads RECRAFT_API_KEY + IMAGE_STORAGE_DIRECTORY +
      // RECRAFT_REMOTE_RESULTS_STORAGE from its env; the parent's
      // process.env is NOT inherited by default, so we pass through
      // the Recraft-specific keys.
      const env: Record<string, string> = {};
      if (secrets['RECRAFT_API_KEY']) env['RECRAFT_API_KEY'] = secrets['RECRAFT_API_KEY'];
      if (secrets['IMAGE_STORAGE_DIRECTORY']) env['IMAGE_STORAGE_DIRECTORY'] = secrets['IMAGE_STORAGE_DIRECTORY'];
      // Prefer remote storage by default so the local server doesn't
      // require a writable storage directory in a server context.
      env['RECRAFT_REMOTE_RESULTS_STORAGE'] = secrets['RECRAFT_REMOTE_RESULTS_STORAGE'] ?? '1';
      // Inherit PATH so npx can find node / npm.
      if (process.env['PATH']) env['PATH'] = process.env['PATH'];
      if (process.env['HOME']) env['HOME'] = process.env['HOME'];

      await client.connect(
        new StdioClientTransport({
          command: LOCAL_COMMAND,
          args: LOCAL_ARGS,
          env,
        }),
      );
    }

    return new McpRecraftTransport(client);
  }

  async generateImage(args: RecraftGenerateArgs): Promise<RecraftGenerateResult> {
    // Recraft's MCP tool name confirmed against the recraft-ai/mcp-recraft-server
    // README (2026-05-25). Arguments are passed structurally; Recraft's
    // schema accepts {prompt, size, style, substyle?, model?, number_of_images?}.
    const response = await this.client.callTool({
      name: RECRAFT_TOOL_NAME,
      arguments: {
        prompt: args.prompt,
        size: args.size,
        style: args.style,
        substyle: args.substyle,
        model: args.model,
      } as Record<string, unknown>,
    });

    return parseRecraftResponse(response);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

// Parse Recraft's MCP tool response into RecraftGenerateResult. The
// server typically returns:
//   - An image content block (base64 data + mimeType), or
//   - A text content block with a JSON payload containing a `url`, or
//   - A combination. We accept both and yield whichever is present;
//     the calling pipeline favors `url` over `data` when both exist.
function parseRecraftResponse(response: unknown): RecraftGenerateResult {
  const out: RecraftGenerateResult = {};
  const r = response as { content?: unknown[]; structuredContent?: unknown };
  const content = Array.isArray(r.content) ? r.content : [];

  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;

    if (b['type'] === 'image' && typeof b['data'] === 'string') {
      out.data = base64ToBytes(b['data']);
      if (typeof b['mimeType'] === 'string') out.mimeType = b['mimeType'];
    }
    if (b['type'] === 'text' && typeof b['text'] === 'string') {
      // Try to parse a URL out of the text payload (Recraft sometimes
      // returns JSON {url, ...} as a text block).
      const text = b['text'];
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed['url'] === 'string') out.url = parsed['url'];
      } catch {
        // Not JSON; ignore.
      }
    }
  }

  // structuredContent (MCP 2026-07-28+) may carry the parsed payload directly.
  if (r.structuredContent && typeof r.structuredContent === 'object') {
    const sc = r.structuredContent as Record<string, unknown>;
    if (typeof sc['url'] === 'string' && !out.url) out.url = sc['url'];
  }

  out.raw = response;
  return out;
}

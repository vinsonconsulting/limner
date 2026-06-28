// Regression guard for the Phase 6c McpAgent + Durable Object fix.
//
// The Phase 6b workaround (commit 206f07c) used a stateless Streamable-HTTP
// transport that could not hold `Mcp-Session-Id` across the MCP
// `initialize -> notifications/initialized -> tools/list` handshake, so
// `tools/list` returned HTTP 400 and Anthropic degraded to schemas inferred
// from the agent definition. Phase 6c routes one Durable Object per
// `Mcp-Session-Id`, which restores the handshake.
//
// This test boots the real worker (bare LimnerMCP, no OAuth) via wrangler's
// unstable_dev — same esbuild bundling path as `wrangler deploy`, so CJS deps
// like ajv load correctly (the in-process vitest-pool-workers loader could
// not). It then drives the full handshake over HTTP and asserts `tools/list`
// returns the 15-tool registry: FAILS on 6b (400 at tools/list), PASSES on 6c.
//
// The orthogonal OAuth layer is covered by the manual MCP Inspector smoke.
//
// Stateful round-trips (record -> recall) are deliberately NOT exercised
// here. This harness binds no D1, and unstable_dev does not auto-apply D1
// migrations — a record over a D1-bound harness fails with "no such table"
// until the schema is seeded out-of-band (RT-1 confirmed this empirically).
// The DO dispatch -> tool context -> D1 wiring is proven sound (the record
// call routes through the DO to D1, failing only on the missing table) and
// is asserted green at the tool layer (test/tools/state-tools.test.ts,
// InMemoryTransport over a local D1: record/recall/forget, sourceId upsert
// idempotency, recall q/since/until/limit/offset) plus the @limner/core
// parity suite and the manual prod smoke. Re-introduce a transport-level
// state test here once local D1 schema seeding into unstable_dev is wired.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { unstable_dev, type UnstableDevWorker } from 'wrangler';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(__dirname, 'handshake-main.ts');
const CONFIG = resolve(__dirname, 'wrangler.handshake.toml');

const FIXTURE = readFileSync(
  resolve(__dirname, '../../limner-core/test/compose/fixtures/checker-64.png'),
);

function b64(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString('base64');
}

// The Phase 4 tool surface, sorted — mirrors test/stdio.smoke.test.ts so both
// transports assert the same single-source registry.
const EXPECTED_TOOLS = [
  'limner_compose',
  'limner_create_project',
  'limner_forget',
  'limner_generate_dalle',
  'limner_generate_midjourney',
  'limner_generate_recraft',
  'limner_get_project_context',
  'limner_health',
  'limner_list_categories',
  'limner_list_pipelines',
  'limner_list_projects',
  'limner_pipeline_capabilities',
  'limner_recall',
  'limner_record',
  'limner_record_project_note',
  'limner_upscale',
  'limner_vectorize',
  'limner_version',
];

const ACCEPT = 'application/json, text/event-stream';

let worker: UnstableDevWorker;

beforeAll(async () => {
  worker = await unstable_dev(ENTRY, {
    config: CONFIG,
    experimental: { disableExperimentalWarning: true },
  });
}, 60_000);

afterAll(async () => {
  await worker?.stop();
});

// Streamable HTTP responses arrive as either a single JSON object or an SSE
// stream (`data: {...}`). Return the last complete JSON-RPC message either way.
function parseRpc(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const dataLines = trimmed
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice('data:'.length).trim());
  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(dataLines[i]!);
    } catch {
      /* not a complete JSON payload; keep scanning */
    }
  }
  throw new Error(`no JSON-RPC payload found in response body: ${text.slice(0, 300)}`);
}

async function post(body: unknown, sessionId?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: ACCEPT,
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  // UnstableDevWorker.fetch resolves the path against the local dev origin.
  return worker.fetch('/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }) as unknown as Promise<Response>;
}

describe('worker MCP: DO-backed Streamable HTTP handshake (Phase 6c regression guard)', () => {
  test(
    'initialize -> tools/list returns the full 18-tool registry; tools/call routes; prompts/resources advertise',
    { timeout: 60_000 },
    async () => {
      // 1. initialize — opens the session; the server returns an Mcp-Session-Id.
      const initRes = await post({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'handshake-test', version: '0.0.1' },
        },
      });
      expect(initRes.status).toBe(200);
      const sessionId = initRes.headers.get('mcp-session-id');
      expect(sessionId, 'server must issue an Mcp-Session-Id on initialize').toBeTruthy();
      const initBody = parseRpc(await initRes.text());
      expect(initBody.result?.serverInfo?.name).toBe('limner-mcp');

      // 2. notifications/initialized — completes the handshake (notification: no id).
      const notifyRes = await post(
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        sessionId!,
      );
      expect(notifyRes.status).toBeLessThan(300);

      // 3. tools/list — THE regression assertion. 6b returned HTTP 400 here
      //    because the stateless transport lost the session between requests.
      const listRes = await post(
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        sessionId!,
      );
      expect(
        listRes.status,
        'tools/list must succeed over the DO-backed transport (6b regressed this to 400)',
      ).toBe(200);
      const listBody = parseRpc(await listRes.text());
      const names = (listBody.result?.tools ?? []).map((t: { name: string }) => t.name).sort();
      expect(names).toEqual([...EXPECTED_TOOLS].sort());

      // 4. tools/call health — proves dispatch routes through the DO end-to-end.
      const callRes = await post(
        { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'limner_health', arguments: {} } },
        sessionId!,
      );
      expect(callRes.status).toBe(200);
      const callBody = parseRpc(await callRes.text());
      const payload =
        callBody.result?.structuredContent ??
        JSON.parse(callBody.result?.content?.[0]?.text ?? '{}');
      expect(payload.status).toBe('ok');
      expect(payload.bindings).toBe('workers');

      // 5. Review r1 regression guard — compose's WASM-backed ops inside the
      //    real workerd isolate. Before r1, the jsquash wasm never shipped in
      //    the bundle (the glue's fetch(import.meta.url) had nothing to
      //    fetch) and resvg was never initialized, so both calls below failed
      //    at runtime while CI stayed green. This boots the same esbuild
      //    bundle as `wrangler deploy`, so it proves wasm attachment +
      //    initComposeWasmWorkers() end-to-end.
      const convertRes = await post(
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'limner_compose',
            arguments: { op: 'convert', input: b64(FIXTURE), from: 'png', to: 'jpeg', quality: 80 },
          },
        },
        sessionId!,
      );
      expect(convertRes.status).toBe(200);
      const convertBody = parseRpc(await convertRes.text());
      expect(convertBody.result?.isError, JSON.stringify(convertBody.result?.content)).toBeFalsy();
      const jpegBytes = Buffer.from(convertBody.result?.content?.[0]?.data ?? '', 'base64');
      expect(jpegBytes[0]).toBe(0xff); // JPEG magic FF D8 FF
      expect(jpegBytes[1]).toBe(0xd8);

      const renderRes = await post(
        {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'limner_compose',
            arguments: {
              op: 'renderText',
              jsx: {
                type: 'div',
                props: {
                  style: { display: 'flex', width: '100%', height: '100%', fontSize: 24 },
                  children: 'r1',
                },
              },
              width: 120,
              height: 60,
              fonts: [{ fontId: 'ibm-plex-sans' }],
            },
          },
        },
        sessionId!,
      );
      expect(renderRes.status).toBe(200);
      const renderBody = parseRpc(await renderRes.text());
      expect(renderBody.result?.isError, JSON.stringify(renderBody.result?.content)).toBeFalsy();
      const pngBytes = Buffer.from(renderBody.result?.content?.[0]?.data ?? '', 'base64');
      expect([...pngBytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

      // 6. Capability widening (D-RA-24). prompts/list + resources/list must
      //    succeed over the same DO-backed transport, proving the Workers
      //    transport advertises and serves the new capabilities end-to-end
      //    (the stdio transport asserts the same via the InMemory client tests).
      const promptsRes = await post(
        { jsonrpc: '2.0', id: 6, method: 'prompts/list', params: {} },
        sessionId!,
      );
      expect(promptsRes.status).toBe(200);
      const promptsBody = parseRpc(await promptsRes.text());
      const promptNames = (promptsBody.result?.prompts ?? []).map((p: { name: string }) => p.name);
      expect(promptNames).toContain('capability-tour');

      const resourcesRes = await post(
        { jsonrpc: '2.0', id: 7, method: 'resources/list', params: {} },
        sessionId!,
      );
      expect(resourcesRes.status).toBe(200);
      const resourcesBody = parseRpc(await resourcesRes.text());
      const resourceUris = (resourcesBody.result?.resources ?? []).map(
        (r: { uri: string }) => r.uri,
      );
      expect(resourceUris).toContain('limner://reference/file-types');

      // resources/read derives from the guidance entry — assert the table
      // header survives dispatch + serialization over the wire.
      const readRes = await post(
        {
          jsonrpc: '2.0',
          id: 8,
          method: 'resources/read',
          params: { uri: 'limner://reference/file-types' },
        },
        sessionId!,
      );
      expect(readRes.status).toBe(200);
      const readBody = parseRpc(await readRes.text());
      expect(readBody.result?.contents?.[0]?.text ?? '').toContain('| Format | Compression |');
    },
  );
});

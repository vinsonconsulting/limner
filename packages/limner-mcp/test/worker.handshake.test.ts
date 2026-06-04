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

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { unstable_dev, type UnstableDevWorker } from 'wrangler';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(__dirname, 'handshake-main.ts');
const CONFIG = resolve(__dirname, 'wrangler.handshake.toml');

// The Phase 4 tool surface, sorted — mirrors test/stdio.smoke.test.ts so both
// transports assert the same single-source registry.
const EXPECTED_TOOLS = [
  'compose',
  'forget',
  'generate_dalle',
  'generate_midjourney',
  'generate_recraft',
  'get_project_context',
  'health',
  'list_categories',
  'list_pipelines',
  'list_projects',
  'pipeline_capabilities',
  'recall',
  'record',
  'record_project_note',
  'version',
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
    'initialize -> tools/list returns the full 15-tool registry; tools/call routes',
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
        { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'health', arguments: {} } },
        sessionId!,
      );
      expect(callRes.status).toBe(200);
      const callBody = parseRpc(await callRes.text());
      const payload =
        callBody.result?.structuredContent ??
        JSON.parse(callBody.result?.content?.[0]?.text ?? '{}');
      expect(payload.status).toBe('ok');
      expect(payload.bindings).toBe('workers');
    },
  );
});

#!/usr/bin/env -S node --experimental-strip-types
/**
 * 0002_seed_from_cma.ts — one-time backfill of the legacy Anthropic CMA
 * managed-memory entries into the new D1 `memory_entries` table.
 *
 * Per architecture §6 + D-RA-15: this migration is one-time and one-way.
 * It is idempotent — keyed on `source_id = <memory path>` with an
 * ON CONFLICT upsert, so re-running is safe.
 *
 * ---------------------------------------------------------------------------
 * PIPELINE (read -> transform -> SQL -> apply), decoupled by design:
 * ---------------------------------------------------------------------------
 *
 *   1. READ   the legacy entries into a JSON array. Two sources:
 *               a. --from-file <path.json>   (RECOMMENDED; see export snippet)
 *               b. --from-anthropic          (best-effort REST; verify live)
 *
 *   2. TRANSFORM each entry -> a D1 row:
 *               id         fresh ULID
 *               content    entry.content (verbatim)
 *               category   derived from the path (see deriveCategory)
 *               source_id  entry.path     (the idempotency key)
 *               created_at entry.created_at ?? now
 *               updated_at now
 *               metadata   { path, source: 'cma-managed-memory', originalId }
 *
 *   3. SQL    emit idempotent `INSERT ... ON CONFLICT(source_id) DO UPDATE`
 *             statements to --out (default migrations/generated/...).
 *
 *   4. APPLY  operator runs the printed `wrangler d1 execute ... --file=` line.
 *             (Kept as a separate manual step so the SQL is inspectable before
 *             it touches prod D1.)
 *
 * ---------------------------------------------------------------------------
 * EXPORT SNIPPET — produce the --from-file JSON via the legacy CMA agent.
 * Uses the proven Python SDK shape from cma/seed_memory.py. Run from the
 * legacy repo with ANTHROPIC_API_KEY + LIMNER_MEMSTORE_ID in env:
 * ---------------------------------------------------------------------------
 *
 *   python3 - <<'PY' > cma-memory-export.json
 *   import json, os, anthropic
 *   client = anthropic.Anthropic()
 *   store = os.environ["LIMNER_MEMSTORE_ID"]
 *   out = []
 *   for m in client.beta.memory_stores.memories.list(store).data:
 *       if getattr(m, "type", "memory") != "memory":
 *           continue
 *       full = client.beta.memory_stores.memories.retrieve(m.id, memory_store_id=store)
 *       out.append({
 *           "id": m.id,
 *           "path": getattr(m, "path", None) or getattr(full, "path", None),
 *           "content": getattr(full, "content", "") or "",
 *           "created_at": getattr(m, "created_at", None),
 *       })
 *   print(json.dumps(out, indent=2))
 *   PY
 *
 * Then:  pnpm dlx tsx migrations/0002_seed_from_cma.ts --from-file cma-memory-export.json
 *
 * ---------------------------------------------------------------------------
 * USAGE
 * ---------------------------------------------------------------------------
 *
 *   # Dry run — summary table, no SQL written:
 *   pnpm dlx tsx migrations/0002_seed_from_cma.ts --from-file export.json --dry-run
 *
 *   # Generate SQL:
 *   pnpm dlx tsx migrations/0002_seed_from_cma.ts --from-file export.json
 *   # -> writes migrations/generated/0002_seed_from_cma.sql, prints the apply command.
 *
 *   # Apply to prod D1 (operator runs after inspecting the SQL):
 *   cd packages/limner-mcp
 *   wrangler d1 execute limner-rasa-prod --remote \
 *     --file=../../migrations/generated/0002_seed_from_cma.sql
 *
 * Refs: architecture §6, D-RA-15.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A legacy memory entry as exported from Anthropic Memory Stores. */
type SourceEntry = {
  /** Anthropic memory id (opaque). */
  id?: string;
  /** Memory path, e.g. "/_global/style/foo.md". The D1 source_id. */
  path: string;
  /** Memory content (markdown / base64 / text). */
  content: string;
  /** Epoch ms or ISO string; optional. */
  created_at?: number | string | null;
};

type D1Row = {
  id: string;
  content: string;
  category: string;
  source_id: string;
  created_at: number;
  updated_at: number;
  metadata: string;
};

// ---------------------------------------------------------------------------
// ULID (inline; no dependency for a one-time script)
// Crockford base32, 48-bit time + 80-bit randomness, lexicographically sortable.
// ---------------------------------------------------------------------------

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function ulid(seedTime: number): string {
  let ts = seedTime;
  const timeChars: string[] = [];
  for (let i = 9; i >= 0; i--) {
    timeChars[i] = CROCKFORD[ts % 32]!;
    ts = Math.floor(ts / 32);
  }
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += CROCKFORD[Math.floor(Math.random() * 32)];
  }
  return timeChars.join('') + rand;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

/**
 * Derive a category from a memory path:
 *   /_global/style/foo.md             -> "style"
 *   /_global/prompts/templates.md     -> "prompts"
 *   /projects/example-project/x.md  -> "project:example-project"
 *   /anything-else/...                -> "anything-else"
 *   (empty / "/")                     -> "imported"
 */
export function deriveCategory(path: string): string {
  const segs = path.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segs.length === 0) return 'imported';
  if (segs[0] === '_global') return segs[1] ?? 'global';
  if (segs[0] === 'projects') return segs[1] ? `project:${segs[1]}` : 'project';
  return segs[0]!;
}

function toEpochMs(value: number | string | null | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: treat <1e12 as seconds, else ms.
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

export function transform(entries: SourceEntry[], now: number): D1Row[] {
  return entries.map((e, i) => {
    const createdAt = toEpochMs(e.created_at, now);
    return {
      // Seed the ULID time component from the entry's created_at so the
      // generated ids preserve the source ordering; +i keeps them distinct
      // when timestamps collide.
      id: ulid(createdAt + i),
      content: e.content ?? '',
      category: deriveCategory(e.path),
      source_id: e.path,
      created_at: createdAt,
      updated_at: now,
      metadata: JSON.stringify({
        path: e.path,
        source: 'cma-managed-memory',
        originalId: e.id ?? null,
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// SQL emit (idempotent upsert keyed on source_id)
// ---------------------------------------------------------------------------

function sqlString(value: string): string {
  // SQLite string literal: wrap in single quotes, double internal quotes.
  return `'${value.replace(/'/g, "''")}'`;
}

export function toSql(rows: D1Row[]): string {
  const header = [
    '-- Generated by migrations/0002_seed_from_cma.ts',
    '-- One-time CMA managed-memory -> D1 backfill (architecture §6, D-RA-15).',
    '-- Idempotent: ON CONFLICT(source_id) DO UPDATE. Safe to re-apply.',
    `-- Rows: ${rows.length}`,
    '',
    'BEGIN TRANSACTION;',
    '',
  ];
  const stmts = rows.map(
    (r) =>
      `INSERT INTO memory_entries (id, content, category, source_id, created_at, updated_at, metadata)\n` +
      `VALUES (${sqlString(r.id)}, ${sqlString(r.content)}, ${sqlString(r.category)}, ` +
      `${sqlString(r.source_id)}, ${r.created_at}, ${r.updated_at}, ${sqlString(r.metadata)})\n` +
      `ON CONFLICT(source_id) DO UPDATE SET\n` +
      `  content = excluded.content,\n` +
      `  category = excluded.category,\n` +
      `  updated_at = excluded.updated_at,\n` +
      `  metadata = excluded.metadata;`,
  );
  return [...header, stmts.join('\n\n'), '', 'COMMIT;', ''].join('\n');
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function readFromFile(path: string): SourceEntry[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`--from-file: expected a JSON array, got ${typeof raw}`);
  }
  return raw.map((item, i) => {
    const o = item as Record<string, unknown>;
    if (typeof o['path'] !== 'string') {
      throw new Error(`--from-file: entry ${i} missing string "path"`);
    }
    return {
      id: typeof o['id'] === 'string' ? o['id'] : undefined,
      path: o['path'],
      content: typeof o['content'] === 'string' ? o['content'] : '',
      created_at: (o['created_at'] as number | string | null | undefined) ?? null,
    };
  });
}

/**
 * Best-effort direct read from Anthropic Memory Stores REST. The Memory
 * Stores API is beta; the endpoint shape below mirrors the Python SDK's
 * `client.beta.memory_stores.memories.{list,retrieve}` namespace. If this
 * 4xxs, fall back to the documented Python export + --from-file (the
 * Python SDK path is the proven one from cma/seed_memory.py).
 */
async function readFromAnthropic(): Promise<SourceEntry[]> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  const store = process.env['LIMNER_MEMSTORE_ID'];
  if (!apiKey || !store) {
    throw new Error(
      '--from-anthropic requires ANTHROPIC_API_KEY and LIMNER_MEMSTORE_ID in env',
    );
  }
  const base = 'https://api.anthropic.com/v1';
  const headers = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    // Beta flag for Memory Stores. If the API rejects this value, check
    // the current beta header in the Anthropic docs and update here.
    'anthropic-beta': 'memory-stores-2025-06-01',
  };

  const listUrl = `${base}/memory_stores/${encodeURIComponent(store)}/memories`;
  const listResp = await fetch(listUrl, { headers });
  if (!listResp.ok) {
    throw new Error(
      `Anthropic list failed: HTTP ${listResp.status} ${await listResp.text()}\n` +
        `The Memory Stores REST shape is beta; use the documented Python export + --from-file instead.`,
    );
  }
  const listed = (await listResp.json()) as { data?: Array<Record<string, unknown>> };
  const items = listed.data ?? [];
  const out: SourceEntry[] = [];
  for (const m of items) {
    if (m['type'] && m['type'] !== 'memory') continue;
    const id = String(m['id'] ?? '');
    const path = String(m['path'] ?? '');
    if (!path) continue;
    // Retrieve full content per entry.
    const detResp = await fetch(`${listUrl}/${encodeURIComponent(id)}`, { headers });
    const content = detResp.ok
      ? String(((await detResp.json()) as Record<string, unknown>)['content'] ?? '')
      : '';
    out.push({ id, path, content, created_at: (m['created_at'] as number | undefined) ?? null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  fromFile?: string;
  fromAnthropic: boolean;
  dryRun: boolean;
  out: string;
} {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  let fromFile: string | undefined;
  let fromAnthropic = false;
  let dryRun = false;
  let out = resolve(__dirname, 'generated', '0002_seed_from_cma.sql');
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from-file') fromFile = argv[++i];
    else if (a === '--from-anthropic') fromAnthropic = true;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--out') out = resolve(argv[++i]!);
  }
  return { fromFile, fromAnthropic, dryRun, out };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.fromFile && !args.fromAnthropic) {
    process.stderr.write(
      'error: provide --from-file <path.json> or --from-anthropic.\n' +
        'See the export snippet in this file\'s header for producing the JSON.\n',
    );
    process.exit(2);
  }

  const entries = args.fromFile ? readFromFile(args.fromFile) : await readFromAnthropic();
  // Deterministic-ish "now": the script stamps updated_at once per run.
  const now = Date.now();
  const rows = transform(entries, now);

  // Summary table (always printed).
  process.stderr.write(`\nCMA -> D1 migration plan (${rows.length} entries):\n`);
  for (const r of rows) {
    const bytes = Buffer.byteLength(r.content, 'utf8');
    process.stderr.write(`  ${r.category.padEnd(28)} ${r.source_id}  (${bytes} bytes)\n`);
  }
  const categories = [...new Set(rows.map((r) => r.category))].sort();
  process.stderr.write(`\nCategories: ${categories.join(', ')}\n`);

  if (args.dryRun) {
    process.stderr.write('\n--dry-run: no SQL written.\n');
    return;
  }

  const sql = toSql(rows);
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, sql, 'utf8');
  process.stderr.write(`\nWrote ${args.out} (${rows.length} upserts).\n`);
  process.stderr.write(
    '\nApply to prod D1 (inspect the SQL first):\n' +
      '  cd packages/limner-mcp\n' +
      `  wrangler d1 execute limner-rasa-prod --remote --file=${args.out}\n\n` +
      'Then verify:\n' +
      '  wrangler d1 execute limner-rasa-prod --remote \\\n' +
      "    --command \"SELECT COUNT(*) AS n FROM memory_entries\"\n",
  );
}

// Only run main() when executed directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`migration failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  });
}

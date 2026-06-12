#!/usr/bin/env node
// One-command Cloudflare provisioning for a self-deployed limner stack
// (launch S2). Takes a fresh clone from `wrangler login` to a deployed,
// smoke-tested Worker:
//
//   auth check -> D1 -> KV -> R2 -> patch wrangler.toml ids -> apply
//   migration 0001 -> (optional example seed) -> build -> deploy ->
//   secrets -> smoke -> client connect instructions
//
// Usage:
//   node scripts/setup-cloudflare.mjs [--env dev|production]
//                                     [--with-example-seed] [--dry-run] [--yes]
//
//   --env                dev (top-level config, default) or production
//   --with-example-seed  apply migrations/seed/example-memory-export.json
//                        through the 0002 generator (never automatic)
//   --dry-run            read-only: list resources, print planned actions
//   --yes                non-interactive: skip confirmations, skip secrets
//                        that are already set
//
// Design notes:
// - Idempotent: every resource is looked up by name (or by the id already
//   patched into wrangler.toml) before creation; re-running resumes.
// - Secrets are set AFTER the first deploy. `wrangler secret put` against a
//   Worker that does not exist yet falls back to an interactive
//   create-draft-worker prompt, which is unreliable when scripted. The
//   Worker boots fine without the keys (generation tools check at call
//   time), so deploy-then-secrets is the dependable order. Both keys are
//   still required for the script to finish successfully.
// - Secret values are read with terminal echo off and passed to wrangler
//   over stdin; they never appear on a command line or in output.
// - Migration 0001 is the only tracked .sql in migrations/, so
//   `wrangler d1 migrations apply` applies exactly the schema. The example
//   seed goes through `wrangler d1 execute --file` separately, opt-in.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const mcpDir = join(repoRoot, 'packages', 'limner-mcp');
const configPath = join(mcpDir, 'wrangler.toml');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flags = {
  env: 'dev',
  withExampleSeed: argv.includes('--with-example-seed'),
  dryRun: argv.includes('--dry-run'),
  yes: argv.includes('--yes'),
};
const envIdx = argv.indexOf('--env');
if (envIdx !== -1) flags.env = argv[envIdx + 1] ?? '';
if (flags.env !== 'dev' && flags.env !== 'production') {
  fail(`--env must be "dev" or "production", got "${flags.env}"`);
}
const isProd = flags.env === 'production';
const envArgs = isProd ? ['--env', 'production'] : [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(message, remediation) {
  console.error(`\nsetup-cloudflare: ${message}`);
  if (remediation) console.error(`  fix: ${remediation}`);
  process.exit(1);
}

/** Run a command, echoing it first. Throws on nonzero exit unless allowFail. */
function run(cmd, args, { cwd = mcpDir, input, allowFail = false, quiet = false } = {}) {
  if (!quiet) console.log(`  $ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error) fail(`${cmd} failed to start: ${res.error.message}`);
  if (res.status !== 0 && !allowFail) {
    console.error(res.stdout);
    console.error(res.stderr);
    fail(`\`${cmd} ${args.join(' ')}\` exited ${res.status}`);
  }
  return res;
}

const wrangler = (args, opts = {}) => run('pnpm', ['exec', 'wrangler', ...args], opts);

// One shared readline interface for every prompt in the run. Each readline
// instance buffers look-ahead input internally, so per-prompt interfaces
// drop piped lines on close (with two secrets piped in, the second read
// would hang on ended stdin).
let rlShared = null;
let rlMuted = false;

function ui() {
  if (!rlShared) {
    rlShared = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Mask typed characters while a hidden prompt is active. This is the
    // TTY echo path; piped input never echoes, so the override is inert there.
    if (typeof rlShared._writeToOutput === 'function') {
      const orig = rlShared._writeToOutput.bind(rlShared);
      rlShared._writeToOutput = (text) => {
        if (rlMuted) rlShared.output.write('*');
        else orig(text);
      };
    }
  }
  return rlShared;
}

function closeUi() {
  if (rlShared) rlShared.close();
  rlShared = null;
}

function ask(prompt) {
  return new Promise((resolveAsk) => ui().question(prompt, (answer) => resolveAsk(answer.trim())));
}

async function promptHidden(question) {
  process.stdout.write(`${question}: `);
  rlMuted = true;
  try {
    return await ask('');
  } finally {
    rlMuted = false;
    process.stdout.write('\n');
  }
}

function confirm(question) {
  if (flags.yes) return Promise.resolve(true);
  return ask(`${question} [y/N] `).then((answer) => /^y(es)?$/i.test(answer));
}

function step(title) {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
// Config parsing (section-scoped: top-level = dev, [env.production] = prod)
// ---------------------------------------------------------------------------

function readConfigSections() {
  const text = readFileSync(configPath, 'utf8');
  const splitAt = text.indexOf('[[env.production.');
  const altSplit = text.indexOf('[env.production');
  const idx =
    splitAt === -1 ? altSplit : altSplit === -1 ? splitAt : Math.min(splitAt, altSplit);
  if (idx === -1) fail('wrangler.toml has no [env.production] section; config drift?');
  return { text, head: text.slice(0, idx), tail: text.slice(idx) };
}

function sectionFor(sections) {
  return isProd ? sections.tail : sections.head;
}

function extract(pattern, section, what) {
  const m = section.match(pattern);
  if (!m) fail(`could not find ${what} in wrangler.toml's ${flags.env} section`);
  return m[1];
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function preflight() {
  step('Preflight');
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    fail(`Node ${process.versions.node} is below the 22.13 floor`, 'install Node 22.13+ (.nvmrc says 22)');
  }
  if (run('pnpm', ['--version'], { allowFail: true, quiet: true }).status !== 0) {
    fail('pnpm not found', 'corepack enable && corepack prepare pnpm@latest --activate');
  }
  const who = wrangler(['whoami'], { allowFail: true });
  if (who.status !== 0 || /not authenticated|please log ?in/i.test(who.stdout + who.stderr)) {
    fail('wrangler is not authenticated', 'run: pnpm --filter @limner/mcp exec wrangler login');
  }
  const account = (who.stdout.match(/│\s*(.+?)\s*│\s*[0-9a-f]{32}/) ?? [])[1];
  console.log(`  authenticated${account ? ` (account: ${account})` : ''}`);
}

function ensureD1(dbName) {
  step(`D1 database: ${dbName}`);
  const list = wrangler(['d1', 'list', '--json']);
  const dbs = JSON.parse(list.stdout);
  let db = dbs.find((d) => d.name === dbName);
  if (db) {
    console.log(`  exists (${db.uuid})`);
  } else if (flags.dryRun) {
    console.log(`  [dry-run] would create: wrangler d1 create ${dbName}`);
    return null;
  } else {
    wrangler(['d1', 'create', dbName]);
    db = JSON.parse(wrangler(['d1', 'list', '--json']).stdout).find((d) => d.name === dbName);
    if (!db) fail(`created ${dbName} but cannot find it in d1 list`, 'retry; check dash.cloudflare.com');
    console.log(`  created (${db.uuid})`);
  }
  return db.uuid;
}

function ensureKv(currentId) {
  step('KV namespace: OAUTH_KV');
  const list = JSON.parse(wrangler(['kv', 'namespace', 'list']).stdout);
  if (currentId && list.some((n) => n.id === currentId)) {
    console.log(`  config id already provisioned (${currentId})`);
    return currentId;
  }
  // Titles wrangler derives for `kv namespace create OAUTH_KV` in this project.
  const candidates = list.filter((n) =>
    isProd
      ? /^limner-mcp-production-OAUTH_KV$/.test(n.title)
      : /^limner-mcp-OAUTH_KV$/.test(n.title),
  );
  if (candidates.length === 1) {
    console.log(`  reusing existing namespace "${candidates[0].title}" (${candidates[0].id})`);
    return candidates[0].id;
  }
  if (candidates.length > 1) {
    fail(
      `multiple KV namespaces match: ${candidates.map((n) => n.title).join(', ')}`,
      'delete the stale one or patch its id into wrangler.toml manually',
    );
  }
  if (flags.dryRun) {
    console.log(`  [dry-run] would create: wrangler kv namespace create OAUTH_KV ${envArgs.join(' ')}`);
    return null;
  }
  const created = wrangler(['kv', 'namespace', 'create', 'OAUTH_KV', ...envArgs]);
  const m = (created.stdout + created.stderr).match(/id\s*[=:]\s*"([0-9a-f]{32})"/);
  if (!m) fail('could not parse the new KV namespace id from wrangler output', 'run `wrangler kv namespace list` and patch wrangler.toml manually');
  console.log(`  created (${m[1]})`);
  return m[1];
}

function ensureR2(bucketName) {
  step(`R2 bucket: ${bucketName}`);
  const list = wrangler(['r2', 'bucket', 'list'], { allowFail: true });
  if (list.status !== 0) {
    const out = list.stdout + list.stderr;
    if (/not enabled|enable R2|payment/i.test(out)) {
      fail(
        'R2 is not enabled on this account',
        'enable R2 once in the dashboard (R2 -> purchase/enable; free tier, may require a payment method on file), then re-run',
      );
    }
    console.error(out);
    fail('wrangler r2 bucket list failed');
  }
  const names = [...list.stdout.matchAll(/^name:\s+(\S+)/gm)].map((m) => m[1]);
  if (names.includes(bucketName)) {
    console.log('  exists');
    return;
  }
  if (flags.dryRun) {
    console.log(`  [dry-run] would create: wrangler r2 bucket create ${bucketName}`);
    return;
  }
  wrangler(['r2', 'bucket', 'create', bucketName]);
  console.log('  created');
}

function patchConfig(sections, d1Id, kvId) {
  step('Pin resource ids in wrangler.toml');
  if (flags.dryRun) {
    console.log(`  [dry-run] would pin ${flags.env} database_id -> ${d1Id ?? '(new)'}, OAUTH_KV id -> ${kvId ?? '(new)'}`);
    return;
  }
  let section = sectionFor(sections);
  const before = section;
  // The committed config intentionally omits ids; insert after the binding's
  // anchor line on first run, replace in place on re-runs.
  if (/database_id = "[0-9a-f-]{36}"/.test(section)) {
    section = section.replace(/database_id = "[0-9a-f-]{36}"/, `database_id = "${d1Id}"`);
  } else {
    section = section.replace(/(database_name = "[^"]+"\n)/, `$1database_id = "${d1Id}"\n`);
  }
  if (/\bid = "[0-9a-f]{32}"/.test(section)) {
    section = section.replace(/\bid = "[0-9a-f]{32}"/, `id = "${kvId}"`);
  } else {
    section = section.replace(/(binding = "OAUTH_KV"\n)/, `$1id = "${kvId}"\n`);
  }
  if (section === before) {
    console.log('  ids already current; nothing to pin');
    return;
  }
  const next = isProd ? sections.head + section : section + sections.tail;
  writeFileSync(configPath, next, 'utf8');
  console.log(`  patched ${flags.env} ids (this makes packages/limner-mcp/wrangler.toml`);
  console.log('  dirty in git — expected; commit it in your fork or leave it local)');
  // Refresh in-memory sections for any later step.
  const refreshed = readConfigSections();
  sections.text = refreshed.text;
  sections.head = refreshed.head;
  sections.tail = refreshed.tail;
}

function applyMigrations(dbName) {
  step('Apply schema migration (0001)');
  if (flags.dryRun) {
    console.log(`  [dry-run] would run: wrangler d1 migrations apply ${dbName} --remote ${envArgs.join(' ')}`);
    return;
  }
  wrangler(['d1', 'migrations', 'apply', dbName, '--remote', ...envArgs]);
  console.log('  schema applied (or already up to date)');
}

function applyExampleSeed(dbName) {
  step('Apply example seed (opt-in)');
  const exportJson = join(repoRoot, 'migrations', 'seed', 'example-memory-export.json');
  if (!existsSync(exportJson)) fail(`missing ${exportJson}`);
  const outSql = join(tmpdir(), `limner-example-seed-${process.pid}.sql`);
  if (flags.dryRun) {
    console.log(`  [dry-run] would generate SQL from ${exportJson} and d1 execute it`);
    return;
  }
  run('node', [
    '--experimental-strip-types',
    join(repoRoot, 'migrations', '0002_seed_from_cma.ts'),
    '--from-file', exportJson,
    '--out', outSql,
  ], { cwd: repoRoot });
  wrangler(['d1', 'execute', dbName, '--remote', `--file=${outSql}`, ...envArgs]);
  console.log('  example seed applied (idempotent upserts keyed on source_id)');
}

function buildAndDeploy() {
  step('Build and deploy');
  if (flags.dryRun) {
    console.log(`  [dry-run] would run: pnpm install + pnpm -r build + wrangler deploy ${envArgs.join(' ')}`);
    return null;
  }
  if (!existsSync(join(repoRoot, 'node_modules'))) {
    run('pnpm', ['install', '--frozen-lockfile'], { cwd: repoRoot });
  }
  run('pnpm', ['-r', 'build'], { cwd: repoRoot });
  const deploy = wrangler(['deploy', ...envArgs]);
  const out = deploy.stdout + deploy.stderr;
  const url = (out.match(/https:\/\/[^\s]+\.workers\.dev/) ?? [])[0] ?? null;
  console.log(url ? `  deployed: ${url}` : '  deployed (no workers.dev URL in output — custom route?)');
  return url;
}

async function ensureSecrets() {
  step('Secrets (OPENAI_API_KEY, RECRAFT_API_KEY)');
  if (flags.dryRun) {
    console.log('  [dry-run] would prompt for both keys and `wrangler secret put` them');
    return;
  }
  const listRes = wrangler(['secret', 'list', '--format', 'json', ...envArgs], { allowFail: true });
  const existing = listRes.status === 0
    ? JSON.parse(listRes.stdout).map((s) => s.name)
    : [];
  for (const name of ['OPENAI_API_KEY', 'RECRAFT_API_KEY']) {
    if (existing.includes(name)) {
      if (flags.yes || !(await confirm(`  ${name} is already set — overwrite?`))) {
        console.log(`  ${name}: keeping existing value`);
        continue;
      }
    }
    const value = await promptHidden(`  enter ${name}`);
    if (!value) fail(`${name} is required — both provider keys must be set for a working stack`);
    wrangler(['secret', 'put', name, ...envArgs], { input: value });
    console.log(`  ${name}: set`);
  }
}

async function smoke(url) {
  step('Smoke checks');
  if (flags.dryRun || !url) {
    console.log('  [skipped] no deployed URL in this run');
    return;
  }
  const get = async (path) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fetch(`${url}${path}`, { redirect: 'manual' });
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  };
  const root = await get('/');
  if (root.status !== 200) fail(`GET / returned ${root.status}, expected 200`);
  if (!(await root.text()).includes('limner-mcp')) fail('GET / body does not identify limner-mcp');
  console.log('  GET / -> 200, identifies limner-mcp');

  const meta = await get('/.well-known/oauth-authorization-server');
  if (meta.status !== 200) fail(`OAuth discovery returned ${meta.status}, expected 200`);
  const metaBody = await meta.json();
  if (!metaBody.issuer) fail('OAuth discovery JSON has no issuer field');
  console.log('  GET /.well-known/oauth-authorization-server -> 200 with issuer');

  const mcp = await fetch(`${url}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  if (mcp.status !== 401) fail(`unauthenticated POST /mcp returned ${mcp.status}, expected 401`);
  console.log('  POST /mcp without a token -> 401 (OAuth gate up)');

  await stdioSanity();
}

async function stdioSanity() {
  // Boot the local stdio server exactly like an MCP client and assert the
  // registry answers. Mirrors scripts/smoke-mcpb.mjs; the SDK resolves
  // through @limner/mcp's dependency graph.
  const stdioEntry = join(mcpDir, 'dist', 'stdio.js');
  if (!existsSync(stdioEntry)) {
    console.log('  stdio sanity skipped (dist/stdio.js not built)');
    return;
  }
  const mcpRequire = createRequire(join(mcpDir, 'package.json'));
  const { Client } = await import(mcpRequire.resolve('@modelcontextprotocol/sdk/client/index.js'));
  const { StdioClientTransport } = await import(mcpRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js'));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [stdioEntry],
    env: { LIMNER_DB_PATH: join(tmpdir(), `limner-setup-smoke-${process.pid}.db`) },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'setup-smoke', version: '0.0.1' }, { capabilities: {} });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    if (tools.length < 15) fail(`stdio tools/list returned ${tools.length} tools, expected >= 15`);
    console.log(`  local stdio server lists ${tools.length} tools`);
  } finally {
    await client.close();
  }
}

function printConnectInstructions(url) {
  step('Connect a client');
  const endpoint = url ? `${url}/mcp` : 'https://limner-mcp.<your-subdomain>.workers.dev/mcp';
  console.log(`
  Claude Code:
    claude mcp add --transport http limner ${endpoint}

  Claude Desktop:
    Settings -> Connectors -> Add custom connector -> ${endpoint}
    (OAuth dynamic client registration handles the rest.)

  MCP Inspector:
    npx @modelcontextprotocol/inspector
    then connect to ${endpoint} with transport "Streamable HTTP".

  Local stdio (no Cloudflare account needed):
    pnpm --filter @limner/mcp start:stdio
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`setup-cloudflare: env=${flags.env}${flags.dryRun ? ' (dry-run)' : ''}`);

preflight();

const sections = readConfigSections();
const section = sectionFor(sections);
const dbName = extract(/database_name = "([^"]+)"/, section, 'database_name');
const bucketName = extract(/bucket_name = "([^"]+)"/, section, 'bucket_name');
// Absent on a fresh clone (ids are intentionally omitted from the committed
// config); present once a previous run has pinned it.
const currentKvId = (section.match(/\bid = "([0-9a-f]{32})"/) ?? [])[1];

const d1Id = ensureD1(dbName);
const kvId = ensureKv(currentKvId);
ensureR2(bucketName);
patchConfig(sections, d1Id, kvId);
applyMigrations(dbName);
if (flags.withExampleSeed) applyExampleSeed(dbName);
const url = buildAndDeploy();
await ensureSecrets();
closeUi();
await smoke(url);
printConnectInstructions(url);

console.log('setup-cloudflare: done.');

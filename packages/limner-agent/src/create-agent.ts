// CMA agent create/version entry point (D-RA-24). Replaces the former
// documented stub now that the Managed Agents + Skills API is pinned (see
// agent-def.ts for the verified contract and doc links).
//
// DEFAULT = dry run: validate the system prompt + every skill, build the request
// payloads, print them, and exit 0 — no network, no credentials. This is the
// only mode the test exercises and the only mode meant to run in CI.
//
// LIVE (--execute, requires ANTHROPIC_API_KEY): for each skill in SKILL_MANIFEST
// creates a fresh skill (or versions an existing one when its id is supplied),
// then creates or versions the Limner agent with all skills attached. Mutates
// production — run deliberately, never automatically.
//
// Create-vs-version is per skill: pass `--skill-id <skillDir>=<skill_id>` (or a
// bare `--skill-id <id>` / LIMNER_SKILL_ID, which both map to file-types) to
// version that skill; any skill without an id is created fresh.
//
// Run via: pnpm --filter @limner/limner-agent create-agent  (node dist/create-agent.js)
//
// Limner is an independent third-party project on Anthropic's CMA platform; this
// script *uses* the CMA API. It is not an Anthropic or Claude product.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';

import {
  BETA_AGENTS,
  BETA_SKILLS,
  FILE_TYPES_SKILL_ROOT,
  SKILL_MANIFEST,
  buildAgentPlan,
  buildSkillUploadPlans,
  type SkillAttachment,
  type SkillUploadInput,
} from './agent-def.js';

const here = dirname(fileURLToPath(import.meta.url));
// From dist/create-agent.js up to the package root, then into prompts/ + skills/.
const SYSTEM_PROMPT_PATH = resolve(here, '../prompts/system-prompt.md');
const SKILLS_DIR = resolve(here, '../skills');

interface Cli {
  execute: boolean;
  /** Version an existing agent (POST /v1/agents/{id}) instead of creating one. */
  agentId?: string;
  /** Existing skill ids to version, keyed by skillDir; absent dir → create fresh. */
  skillIds: Map<string, string>;
}

function parseArgs(argv: readonly string[]): Cli {
  const cli: Cli = { execute: false, skillIds: new Map() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--execute') cli.execute = true;
    else if (arg === '--agent-id') cli.agentId = argv[++i];
    else if (arg === '--skill-id') {
      const raw = argv[++i] ?? '';
      const eq = raw.indexOf('=');
      // `<skillDir>=<id>` targets that skill; a bare id maps to file-types so the
      // proven single-skill invocation keeps working.
      if (eq >= 0) cli.skillIds.set(raw.slice(0, eq), raw.slice(eq + 1));
      else if (raw) cli.skillIds.set(FILE_TYPES_SKILL_ROOT, raw);
    }
  }
  cli.agentId ??= process.env.LIMNER_AGENT_ID;
  const envSkillId = process.env.LIMNER_SKILL_ID;
  if (envSkillId && !cli.skillIds.has(FILE_TYPES_SKILL_ROOT)) {
    cli.skillIds.set(FILE_TYPES_SKILL_ROOT, envSkillId);
  }
  return cli;
}

/** Read each manifest skill's SKILL.md and pair it with its existing id (if any). */
function readSkillInputs(skillIds: ReadonlyMap<string, string>): SkillUploadInput[] {
  return SKILL_MANIFEST.map(({ skillDir, displayTitle }) => ({
    skillDir,
    displayTitle,
    skillMd: readFileSync(resolve(SKILLS_DIR, skillDir, 'SKILL.md'), 'utf8'),
    existingSkillId: skillIds.get(skillDir),
  }));
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  const system = readFileSync(SYSTEM_PROMPT_PATH, 'utf8');

  // Pure validation + plan building. buildSkillUploadPlans throws on any skill's
  // frontmatter violation, and buildAgentPlan asserts A4 framing — both before
  // any network call is considered.
  const uploadPlans = buildSkillUploadPlans(readSkillInputs(cli.skillIds));

  if (!cli.execute) {
    const placeholders: SkillAttachment[] = uploadPlans.map((p) => ({
      type: 'custom',
      skill_id: p.existingSkillId ?? `<skill_id assigned at upload: ${p.skillDir}>`,
      version: 'latest',
    }));
    const agentPlan = buildAgentPlan({ system, skills: placeholders });
    const preview = {
      mode: 'dry-run',
      betas: { agents: BETA_AGENTS, skills: BETA_SKILLS },
      skills: uploadPlans.map((p) => ({
        skillDir: p.skillDir,
        endpoint: p.endpoint,
        mode: p.existingSkillId ? 'version existing' : 'create new',
        display_title: p.displayTitle,
        files: p.files.map((f) => ({
          path: f.path,
          bytes: Buffer.byteLength(f.content, 'utf8'),
          contentType: f.contentType,
        })),
      })),
      agent: cli.agentId
        ? {
            // Versioning an existing agent updates ONLY skills; system / name /
            // model / tools / mcp_servers are omitted and therefore preserved.
            endpoint: `POST /v1/agents/${cli.agentId}`,
            mode: 'version existing (skills only)',
            skills: agentPlan.skills,
            preserves: ['system', 'name', 'model', 'tools', 'mcp_servers'],
          }
        : {
            endpoint: 'POST /v1/agents',
            mode: 'create new',
            name: agentPlan.name,
            model: agentPlan.model,
            skills: agentPlan.skills,
            systemPromptBytes: Buffer.byteLength(agentPlan.system, 'utf8'),
          },
    };
    process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
    process.stdout.write(
      '\ncreate-agent: dry run only — no API calls made. ' +
        'Re-run with --execute (and ANTHROPIC_API_KEY set) to register.\n',
    );
    return;
  }

  // ---- LIVE ----
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('create-agent --execute requires ANTHROPIC_API_KEY in the environment');
  }

  // SDK loaded only on the live path so the dry run needs neither it nor a key.
  // The SDK auto-applies the BETA_SKILLS / BETA_AGENTS headers for these calls.
  const { default: Anthropic, toFile } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  // Upload each skill (create or version), collecting the attachments to wire
  // onto the agent in one update.
  const attachments: SkillAttachment[] = [];
  const uploaded: { skillDir: string; mode: 'create' | 'version'; id: string; version: string }[] = [];
  for (const plan of uploadPlans) {
    const md = plan.files[0]!.content;
    const file = await toFile(Buffer.from(md, 'utf8'), `${plan.skillDir}/SKILL.md`, {
      type: 'text/markdown',
    });
    let skillId: string;
    let version: string;
    if (plan.existingSkillId) {
      const v = await client.beta.skills.versions.create(plan.existingSkillId, { files: [file] });
      skillId = plan.existingSkillId;
      version = v.version;
    } else {
      const s = await client.beta.skills.create({ display_title: plan.displayTitle, files: [file] });
      skillId = s.id;
      version = s.latest_version ?? 'latest';
    }
    attachments.push({ type: 'custom', skill_id: skillId, version });
    uploaded.push({
      skillDir: plan.skillDir,
      mode: plan.existingSkillId ? 'version' : 'create',
      id: skillId,
      version,
    });
  }

  const agentPlan = buildAgentPlan({ system, skills: attachments });
  let agent;
  let previousVersion: number | undefined;
  if (cli.agentId) {
    // Version an EXISTING agent: update ONLY the skill attachments. `system`,
    // `name`, and `model` are deliberately omitted (as `tools`/`mcp_servers`
    // always are) so the CMA update — which leaves omitted fields untouched —
    // preserves the live agent's externally-managed system prompt and tool/MCP
    // wiring. Update mints a new version, so it needs the current version as an
    // optimistic-concurrency token: retrieve it first (also the rollback target).
    const current = await client.beta.agents.retrieve(cli.agentId);
    previousVersion = current.version;
    agent = await client.beta.agents.update(cli.agentId, {
      version: current.version,
      skills: agentPlan.skills,
    });
  } else {
    // Create a NEW agent from the full repo-defined plan. `tools`/`mcp_servers`
    // stay omitted by design (they couple to the consumer Worker).
    agent = await client.beta.agents.create({
      name: agentPlan.name,
      model: agentPlan.model,
      system: agentPlan.system,
      skills: agentPlan.skills,
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: 'live',
        skills: uploaded,
        agent: { id: agent.id, version: agent.version, previousVersion },
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`create-agent: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

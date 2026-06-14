// CMA agent create/version — DOCUMENTED STUB (D-RA-24).
//
// This script will register/version the Limner agent definition (system prompt
// + attached skills) against the CMA managed-agents API once that API can be
// confidently pinned AND the Phase-7 consumer Worker exists. It is intentionally
// NOT implemented: the managed-agents create/version request shape (endpoints,
// beta headers, skill-attachment schema) could not be verified at scaffold
// time, and inventing it would bake guesses into a public repo.
//
// Verified and well-established (safe to rely on now):
//   - Agent Skills SKILL.md format + progressive disclosure:
//       https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
//       https://agentskills.io/specification
//   - The skills/ authoring convention in this package (skills/<name>/SKILL.md),
//     and the A4-framed system prompt in prompts/system-prompt.md.
//
// Must be pinned before implementing (do NOT guess these):
//   - CMA managed-agents create/version endpoint + required beta header:
//       https://platform.claude.com/docs/en/managed-agents
//   - Custom skill upload + attachment to an agent definition.
//   - Cloudflare self-hosted CMA template (how the agent Worker loads skills):
//       https://github.com/cloudflare/claude-managed-agents
//
// TODO(D-RA-24): implement live create/version once the API is pinned and the
// Phase-7 consumer Worker is in place. Until then this script fails loudly so
// nobody mistakes a placeholder for working wiring.

import process from 'node:process';

process.stderr.write(
  [
    'create-agent: not implemented (documented stub).',
    'The CMA agent create/version API is not yet pinned for Limner; see the',
    'doc links and TODO in scripts/create-agent.ts. Authoring (SKILL.md +',
    'system prompt) is live; live registration is deferred to Phase 7.',
    '',
  ].join('\n'),
);
process.exit(1);

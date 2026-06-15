# @limner/limner-agent

The **CMA agent home** for Limner: the system prompt and Agent Skills that a
self-hosted [Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents)
(CMA) consumer Worker loads. This is Path A of decision **D-RA-24**.

> Limner is an independent third-party project built on Anthropic's CMA
> platform; it is not an Anthropic or Claude product.

## The anti-drift contract

Three surfaces, one source. Every concept's shared content lives once in the
guidance core (`@limner/core/src/guidance/`) and is rendered by one serializer:

| Surface | Where | Derives at |
| --- | --- | --- |
| MCP **resource** (`limner://reference/file-types`) | `@limner/mcp` | runtime |
| MCP **prompt** (`capability-tour`) | `@limner/mcp` | runtime |
| CMA **skill** (`skills/*/SKILL.md`) | this package | **build time** |

A `SKILL.md` is markdown, not TypeScript, so it can't import the serializer at
runtime. Instead a generator writes the guidance-derived section into the file
between markers, and a drift-check test fails CI if the committed file ever
diverges. The `file-types` example proves it: its skill section and the MCP
`file-types` resource are byte-identical because both come from the one
`file-types` guidance entry.

## Layout

```
skills/file-types/SKILL.md   # concept #14 knowledge-skill (generated region + prose)
prompts/system-prompt.md     # A4-framed Limner agent system prompt
src/skill-gen.ts             # pure splice + guidance-derived block (shared logic)
src/gen-skills.ts            # fs entrypoint — writes SKILL.md (the only fs file)
src/create-agent.ts          # live agent + skill registration (dry-run default; --execute)
test/skills-drift.test.ts    # CI guard: committed SKILL.md == serializer output
```

## Regenerating skills

The generated regions in `SKILL.md` are derived — never hand-edit them.

```bash
cd /Users/jim/GitHub/limner
pnpm --filter @limner/core build          # the generator reads core's dist/
pnpm --filter @limner/limner-agent build  # compiles src/gen-skills.ts -> dist/
pnpm --filter @limner/limner-agent gen:skills
```

`gen:skills` runs the **built** `dist/gen-skills.js` (the source uses `.js`
import specifiers, the repo convention, which only resolve after compilation).
The drift-check test asserts the committed file matches the serializer, so a
forgotten regeneration is caught in CI.

## Agent create/version — live registration

`src/create-agent.ts` (compiled to `dist/create-agent.js`, run via
`pnpm --filter @limner/limner-agent create-agent`) registers the agent
definition and its skill(s) against the CMA API. It is **dry-run by default**
and only touches the network under `--execute`.

- **Dry run (default)** — prints the exact create-agent payload and the
  skill-upload multipart plan, then exits. No network calls, no credentials.
- **`--execute`** — performs live registration. Requires `ANTHROPIC_API_KEY` in
  the environment; `@anthropic-ai/sdk` is dynamically imported only on this
  path, and the key is never printed or logged.

What it registers (the SDK applies both beta headers automatically):

- **Skill** — `POST /v1/skills` (multipart: `display_title` + `files[]`) by
  default, or a new version of an existing skill via `--skill-id`
  (`POST /v1/skills/{id}/versions`). Beta `skills-2025-10-02`.
- **Agent** — `POST /v1/agents` by default, or a new version of an existing
  agent via `--agent-id` (`POST /v1/agents/{id}`, retrieving the current
  `version` first to pass as the concurrency token). Beta
  `managed-agents-2026-04-01`.

The agent payload carries only `{ name, model, system, skills }` — `tools` and
`mcp_servers` are intentionally omitted. The agent definition (system prompt +
skills) registers independently of the future Phase-7 consumer Worker: per
decision **D-RA-12**, the agent reaches Limner's tools over the OAuth-protected
MCP server (Path B, live now), with the custom-tool consumer Worker (Path A)
still to come. Because `agents.update` preserves omitted fields, versioning the
agent through this script leaves any externally-configured `tools`/`mcp_servers`
wiring intact.

References:

- Agent Skills spec — <https://agentskills.io/specification>
- CMA managed agents — <https://platform.claude.com/docs/en/managed-agents>
- Cloudflare CMA template — <https://github.com/cloudflare/claude-managed-agents>

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
scripts/create-agent.ts      # documented stub: live agent create/version (deferred)
test/skills-drift.test.ts    # CI guard: committed SKILL.md == serializer output
```

## Regenerating skills

The generated regions in `SKILL.md` are derived; never hand-edit them.

From the repo root:

```bash
pnpm --filter @limner/core build          # the generator reads core's dist/
pnpm --filter @limner/limner-agent build  # compiles src/gen-skills.ts -> dist/
pnpm --filter @limner/limner-agent gen:skills
```

`gen:skills` runs the **built** `dist/gen-skills.js` (the source uses `.js`
import specifiers, the repo convention, which only resolve after compilation).
The drift-check test asserts the committed file matches the serializer, so a
forgotten regeneration is caught in CI.

## Agent create/version — deferred (stub)

`scripts/create-agent.ts` is a **documented stub**, not live code. The CMA
managed-agents create/version API (endpoints, beta header, skill-attachment
schema) could not be confidently pinned at scaffold time, and the Phase-7
consumer Worker does not yet exist. Authoring (SKILL.md + system prompt) is
live; live registration is deferred. The script carries the verified doc links
and a `TODO(D-RA-24)`, and exits non-zero so it can't be mistaken for working
wiring. See:

- Agent Skills spec — <https://agentskills.io/specification>
- CMA managed agents — <https://platform.claude.com/docs/en/managed-agents>
- Cloudflare CMA template — <https://github.com/cloudflare/claude-managed-agents>

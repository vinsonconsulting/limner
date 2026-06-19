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
skills/<concept>/SKILL.md    # the six wave-1 skills: file-types, external-tools,
                             #   midjourney, dalle, recraft, illuminated-manuscript
prompts/system-prompt.md     # A4-framed Limner agent system prompt
src/skill-gen.ts             # pure splice + guidance-derived block (shared logic)
src/gen-skills.ts            # fs entrypoint — writes SKILL.md (the only fs file)
src/create-agent.ts          # live agent + multi-skill registration (dry-run default; --execute)
src/test-harness.ts          # pure Test-4 logic: prompts, asset extraction, event reduce, pass/fail
src/test-agent.ts            # Test-4 runner: drives the live agent (dry-validate default; --execute)
test/skills-drift.test.ts    # CI guard: committed SKILL.md == serializer output
test/test-harness.test.ts    # unit tests for the pure Test-4 logic
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

## Agent create/version — live registration

`src/create-agent.ts` (compiled to `dist/create-agent.js`, run via
`pnpm --filter @limner/limner-agent create-agent`) registers the agent
definition and **all skills in `SKILL_MANIFEST`** against the CMA API. It is
**dry-run by default** and only touches the network under `--execute`.

- **Dry run (default)** — prints the per-skill upload plan for every manifest
  skill plus the agent attach plan, then exits. No network calls, no credentials.
- **`--execute`** — performs live registration. Requires `ANTHROPIC_API_KEY` in
  the environment; `@anthropic-ai/sdk` is dynamically imported only on this
  path, and the key is never printed or logged.

What it registers (the SDK applies both beta headers automatically):

- **Skills** — each of the six wave-1 skills in `SKILL_MANIFEST` (`agent-def.ts`)
  is uploaded: `POST /v1/skills` (multipart: `display_title` + `files[]`) to
  create a fresh skill, or `POST /v1/skills/{id}/versions` to version one whose
  id is supplied via `--skill-id <skillDir>=<id>` (a bare `--skill-id <id>` or
  `LIMNER_SKILL_ID` maps to `file-types`, the proven single-skill path). Any
  skill without a supplied id is created fresh. Beta `skills-2025-10-02`.
- **Agent** — `POST /v1/agents` by default, or a new version of an existing
  agent via `--agent-id` (`POST /v1/agents/{id}`, retrieving the current
  `version` first to pass as the concurrency token) — with **all** uploaded
  skills attached in the one update. Beta `managed-agents-2026-04-01`.

The agent payload carries only `{ name, model, system, skills }` — `tools` and
`mcp_servers` are intentionally omitted. The agent definition (system prompt +
skills) registers independently of the future Phase-7 consumer Worker: per
decision **D-RA-12**, the agent reaches Limner's tools over the OAuth-protected
MCP server (Path B, live now), with the custom-tool consumer Worker (Path A)
still to come. Because `agents.update` preserves omitted fields, versioning the
agent through this script leaves any externally-configured `tools`/`mcp_servers`
wiring intact.

## Test 4 — asset-generation harness

`src/test-agent.ts` (compiled to `dist/test-agent.js`, run via
`pnpm --filter @limner/limner-agent test-agent -- [flags]`) is the first
Claude-in-the-loop dogfood: it drives the **live** Limner CMA agent through the
core task — *"from this source photo, produce a Beaux-Arts oil-painting
portrait"* — across each pipeline, plus a format-advice turn that exercises the
`file-types` skill. It is the first real proof the tool schemas pass the Messages
API and that the agent reaches the prod MCP tools over the vault OAuth path.

It is **vision-mediated, not image-to-image**: the generators take text only
(`limner_generate_*` have no image parameter — the `#15` native-image gap), so
the agent *sees* the photo (`claude-sonnet-4-6` vision), derives a feature
description, composes a Beaux-Arts prompt, and calls each pipeline. Each pipeline
only ever receives the agent's description, never the pixels.

The run is **dry-validate by default** and **staged by cost** under `--execute`:

- **Dry-validate (default)** — resolves + validates config and the source image,
  builds the task plan and user-message shapes, prints them, exits 0. No network,
  no credentials, no agent call.
- **`--execute --stage 1`** — *free*: the Midjourney portrait (prompt-only, no
  pipeline spend) + the format-advice turn. Proves vision, prompt composition, a
  real MCP round-trip, schema acceptance, and the skill.
- **`--execute --stage 2`** — **PAID**: the DALL·E + Recraft renditions of the
  same prompt (`--include-compose` adds one `limner_compose`). Bills DALL·E /
  Recraft / agent inference — run only on explicit go.

Wiring (verified against `@anthropic-ai/sdk@0.104.1`): per task it creates a
session (`agent` + `environment_id` + `vault_ids`), opens the event stream,
sends a `user.message` (with the photo as a base64 image block), and drains the
autonomous loop with bounded tool-call and wall-clock caps. It captures the
agent's derived prompt (`agent.mcp_tool_use.input`), each MCP tool result
(`agent.mcp_tool_result`), and the final text, and **unmasks** any
`session.error` — notably the `model_request_failed_error` class that can hide a
tool-schema `invalid_request_error`.

Config + secrets:

- **`ANTHROPIC_API_KEY`** from the environment only — never printed or written.
- Account IDs and the photo are flags/env, never hardcoded: `--agent-id`
  (`LIMNER_AGENT_ID`), `--vault-id` (`LIMNER_VAULT_ID`), optional
  `--environment-id` (`LIMNER_ENV_ID`; a cloud environment is created if absent),
  `--source-image` (`LIMNER_SOURCE_IMAGE`).
- Outputs go to a gitignored `test-runs/<timestamp>/`: rendered assets named by
  pipeline, a per-task `*.transcript.json`, and a `summary.json`. The source
  photo and generated bytes never enter the JSON artifacts (assets are
  summarized by count + filename), and assets route to Drive — they are not
  committed.
- Bounds: `--max-tool-calls` (default 8), `--task-timeout-ms` (default 240000).

References:

- Agent Skills spec — <https://agentskills.io/specification>
- CMA managed agents — <https://platform.claude.com/docs/en/managed-agents>
- Cloudflare CMA template — <https://github.com/cloudflare/claude-managed-agents>

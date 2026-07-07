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

The one-source rule holds across all 19 guidance entries in
`@limner/core/src/guidance/entries/`, in registration order (the order
`listGuidance()` returns):

| Guidance entry | Skill | Prompt | Resource |
| --- | --- | --- | --- |
| `file-types` | ✓ | | ✓ |
| `capabilities-overview` | | ✓ (`capability-tour`) | |
| `external-tools` | ✓ | | ✓ |
| `midjourney-recipe` | ✓ | ✓ (`midjourney-builder`) | |
| `dalle-recipe` | ✓ | ✓ (`dalle-builder`) | |
| `recraft-recipe` | ✓ | ✓ (`recraft-builder`) | |
| `style-profile` | | | |
| `illuminated-manuscript` | ✓ | ✓ | |
| `pipeline-router` | ✓ | ✓ | |
| `brand-stamp` | ✓ | ✓ | |
| `multi-size-export` | ✓ | ✓ | |
| `captioned-graphic` | ✓ | ✓ | |
| `aspect-ratio-crops` | | ✓ | |
| `iterate-on-asset` | ✓ | | |
| `style-from-images` | ✓ | ✓ | |
| `brand-kit` | ✓ | | |
| `art-research` | ✓ | | |
| `vectorize` | ✓ | ✓ | |
| `print-ready` | ✓ | | ✓ |

19 entries render into 16 skills, 12 prompts, and 3 resources. `aspect-ratio-crops`
and `capabilities-overview` are prompt-only (no skill dir), which is why there are
16 skills but 12 prompts. `style-profile` backs no standalone surface: it is the
shared shape (palette, descriptors, medium, provenance) that `brand-kit`,
`style-from-images`, and `art-research` each read and write via
`upsertStyleProfile`/`readStyleProfile`, not a concept with its own skill, prompt,
or resource. The CI drift test (`test/skills-drift.test.ts`) fails the build the
moment a committed `SKILL.md` diverges from what its guidance entry would
currently serialize, so this table cannot silently go stale.

## Skills

The 16 skills attached to the Limner agent, in `SKILL_MANIFEST` attach order
(`agent-def.ts`): the 6 wave-1 concepts first, then 10 wave-2 additions from
D-RA-24. Surface: **S** skill only, **S+P** skill and MCP prompt, **S+R** skill
and MCP resource (see the full matrix above).

| # | Skill | Surface | What it does |
| --- | --- | --- | --- |
| 1 | `file-types` | S+R | Reference for image and document file formats: compression, alpha, color model, typical use. |
| 2 | `external-tools` | S+R | When and how to hand an asset off to GIMP, the Affinity suite, Inkscape, or Krita for work Limner doesn't do itself. |
| 3 | `midjourney` | S+P | How to build a Midjourney prompt: subject and style first, then the parameter flags. |
| 4 | `dalle` | S+P | How to drive the DALL·E pipeline (gpt-image-1 family): size, quality, format, background, reliable text-in-image. |
| 5 | `recraft` | S+P | How to drive the Recraft pipeline: style vs. substyle, vector art from scratch, image-to-image transforms. |
| 6 | `illuminated-manuscript` | S+P | End-to-end illuminated manuscript page: research, generate each element, compose, deliver. |
| 7 | `pipeline-router` | S+P | Choosing the right pipeline for an asset by output kind, cost, and speed, then finishing with upscale/vectorize/compose. |
| 8 | `brand-stamp` | S+P | Stamping a logo or watermark onto a finished image with the compose watermark op. |
| 9 | `multi-size-export` | S+P | Exporting one image at several sizes and formats for web, app, and social. |
| 10 | `captioned-graphic` | S+P | Rendering a caption or headline and compositing it over a base image. |
| 11 | `iterate-on-asset` | S | Recalling a prior generation and varying, restyling, or post-processing it using recorded memory and project notes. |
| 12 | `style-from-images` | S+P | Capturing a user's own reference-image style into a style profile and matching it with native image input. |
| 13 | `brand-kit` | S | Setting a project's brand as a style profile and generating a consistent on-brand batch. |
| 14 | `art-research` | S | Researching an art style or tradition and distilling it into a style profile that steers generation. |
| 15 | `vectorize` | S+P | Tracing a raster image into a scalable SVG for logos, icons, and flat art. |
| 16 | `print-ready` | S+R | Taking an asset toward print: upscaling to print resolution, then CMYK/press handoff. |

## Layout

```
skills/<concept>/SKILL.md    # 16 skills in SKILL_MANIFEST attach order (agent-def.ts):
                             #   6 wave-1 concepts, then 10 wave-2 (D-RA-24)
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

## Agent definition and registration

`src/create-agent.ts` (compiled to `dist/create-agent.js`, run via
`pnpm --filter @limner/limner-agent create-agent`) registers the agent
definition and **all 16 skills in `SKILL_MANIFEST`** against the CMA API. It is
**dry-run by default** and only touches the network under `--execute`.

### Definition reference

- **Model**: `claude-sonnet-4-6` (`LIMNER_AGENT_MODEL`, `agent-def.ts`).
- **Agent name**: `Limner` (`LIMNER_AGENT_NAME`).
- **Beta headers** (the SDK applies both automatically): `managed-agents-2026-04-01`
  for the Agents endpoints, `skills-2025-10-02` for the Skills endpoints.
- **A4 framing is code-enforced, not just written down.** `assertA4()` throws
  before any agent plan is built unless the system prompt contains the verbatim
  `A4_FRAMING` string exported from `@limner/core`:
  > "Limner is an independent third-party project built on Anthropic's CMA
  > platform; it is not an Anthropic or Claude product."

  This is a guarantee, not a convention: `prompts/system-prompt.md` carries the
  string today, and any future edit that drops it fails `buildAgentPlan` before
  a request is ever sent.
- **Skill frontmatter validation** (`validateSkillFrontmatter`, `agent-def.ts`):
  `name` must match `^[a-z0-9-]{1,64}$` and must not contain the reserved
  substrings `anthropic` or `claude`; `description` must be 1-1024 characters;
  neither `name` nor `description` may contain `<` or `>`; the separate
  `display_title` sent to the Skills API must be 1-64 characters.
- **Tools and MCP servers are deliberately absent from the agent plan.**
  `buildAgentPlan` returns exactly `{ name, model, system, skills }`. There is
  no `tools` or `mcp_servers` field in the type at all. They bind to the
  deployed consumer Worker (the OAuth-protected MCP surface), not to the agent
  identity, so the agent definition registers independently of which Worker
  it's pointed at (decision **D-RA-12**).
- **Endpoints.** Skills: `POST /v1/skills` (multipart: `display_title` +
  `files[]`) to create, `POST /v1/skills/{id}/versions` to version an existing
  one (id supplied via `--skill-id <skillDir>=<id>`, or a bare `--skill-id <id>`
  / `LIMNER_SKILL_ID` mapping to `file-types`, the proven single-skill path).
  Agent: `POST /v1/agents` to create, `POST /v1/agents/{id}` to version
  (`--agent-id` / `LIMNER_AGENT_ID`, retrieving the current `version` first as
  the concurrency token). Versioning-only updates skip `system`/`name`/`model`
  deliberately, alongside `tools`/`mcp_servers`, so `agents.update` (which
  leaves omitted fields untouched) preserves whatever the live agent already
  has wired up outside this script.

### Stand-up walkthrough

1. Set `ANTHROPIC_API_KEY` in the environment. It's read only under
   `--execute`, never printed or logged, and `@anthropic-ai/sdk` is dynamically
   imported only on that path.
2. Build the workspace: `pnpm --filter @limner/core build && pnpm --filter @limner/limner-agent build`.
3. Dry run the registration: `pnpm --filter @limner/limner-agent create-agent`.
   This validates every one of the 16 skills' frontmatter plus the agent plan,
   prints the exact `POST /v1/skills` and `POST /v1/agents` request payloads,
   and exits 0 with no network calls and no credentials required.
4. Go live: `pnpm --filter @limner/limner-agent create-agent -- --execute`.
   This uploads (or versions) all 16 skills first, collecting their attachment
   ids, then creates (or versions) the agent with every skill attached in the
   one update.
5. Point the standing agent at your deployed Path B Worker's OAuth-protected
   MCP URL. Tools are never part of the agent definition; the agent reaches
   Limner's tools at runtime as any MCP client would, over the consumer Worker
   you deploy and manage separately from this script.
6. Confirm the wiring with Test 4: `pnpm --filter @limner/limner-agent test-agent`
   (dry-validate by default; `-- --execute --stage 1` for the free Midjourney +
   skill-exercising pass, `-- --stage 2` adds the paid DALL·E/Recraft rendition).

Both registries that expose these 16 skills' sibling tools (`@limner/mcp` and
`@limner/cma-tools`) ship the identical 18 `limner_`-prefixed tool names in
lockstep (D-RA-12); there is no runtime renaming in this repo. The CMA
platform's own dispatcher presents tools to the model under bare names
(stripping `limner_`), which is why the Test 4 harness's `normalizeToolName()`
(`src/test-harness.ts`) exists purely to reconcile an expected tool name
against an observed bare tool-call name when scoring a transcript, not to
rename anything at runtime.

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

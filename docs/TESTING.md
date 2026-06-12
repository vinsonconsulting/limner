# Testing limner

This is the working checklist for exercising a limner deployment, ordered so
that everything free comes first and everything that spends your money comes
last. File what you find as issues: use the "Test finding" template for
matrix results and "Bug report" for breakage.

## Before you start

You test against your own stack. Nothing here touches anyone else's
infrastructure.

Pick a transport:

- **Local stdio** (free, no Cloudflare account): `pnpm install && pnpm -r build`,
  then `pnpm --filter @limner/mcp start:stdio`, or add it to a client as a
  stdio server pointing at `packages/limner-mcp/dist/stdio.js`. Note that the
  stdio server reports itself as `limner-mcp (preview)`: stdio is the preview
  transport at v1, pending the MCP spec refresh.
- **.mcpb bundle** (free, Claude Desktop): build with `pnpm pack:mcpb`, then
  install the bundle in Claude Desktop. Enter your provider keys in the
  install dialog when you want the paid generators.
- **Self-deployed Worker** (Cloudflare account required):
  `pnpm setup:cloudflare` provisions and deploys your own instance, then
  prints connect instructions for Claude Desktop, Claude Code, and MCP
  Inspector. OAuth is handled by dynamic client registration.

Cost summary, so nothing surprises you:

| What | Costs whom |
| --- | --- |
| Meta, memory, project, midjourney tools | Nothing |
| `limner_compose` in-isolate ops | Nothing |
| `limner_compose` cf* ops | Your Cloudflare Images allowance (5,000 free transformations per month, then errors; the paid Images plan lifts the cap) |
| `limner_generate_dalle` | Your OpenAI API credit, per image |
| `limner_generate_recraft` | Your Recraft API credit, per image |

## 1. Discovery and meta (free)

| Tool | Check |
| --- | --- |
| `limner_health` | Returns bindings flavor, a `hasImages` flag, and the version. On stdio, `hasImages` is false by design. |
| `limner_version` | Matches the version you deployed. Record it; the issue templates ask for it. |
| `limner_list_pipelines` | Exactly three pipelines: midjourney, dalle, recraft, each with its required secrets named. |
| `limner_pipeline_capabilities` | For each pipeline id from the previous call, returns kind, transport, and options without erroring. |

## 2. Midjourney prompt composition (free)

`limner_generate_midjourney` composes a prompt string; it never calls an API.
There is no Midjourney API, so the human carries the string to their own
Midjourney client.

- Ask for a simple subject and confirm the output is a single well-formed
  prompt with your parameters (aspect ratio, stylize) reflected.
- Ask for something with constraints (palette, framing) and check the
  constraints survive into the string.
- Same input twice returns the same prompt: this tool is deterministic.

## 3. Compose, in-isolate ops (free)

`limner_compose` is one tool with discriminated ops. These eleven run inside
the V8 isolate (or the local process) and cost nothing: `resize`, `crop`,
`brightness`, `contrast`, `blur` (small radius), `sharpen`, `watermark`,
`encode`, `decode`, `convert`, `renderText`.

Suggested pass, using any small PNG as input:

1. `resize` to 320 wide, then `crop` a square out of the result.
2. `brightness` and `contrast` nudges; confirm the output changes and stays
   the same dimensions.
3. `convert` PNG to WebP and back; both directions decode.
4. `watermark` one image onto another at an offset.
5. `renderText` a short heading; the output is a raster with crisp glyphs.
6. Feed garbage (a text file as image bytes) and confirm the error is a
   clear validation message, not a crash.

## 4. Compose, Cloudflare Images ops (Workers only; uses your allowance)

The five `cf*` ops require the deployed Worker and the Images binding:
`cfTransform`, `cfOverlay`, `cfBlur` (large radius), `cfSmartCrop`,
`cfBackgroundFill`.

- On stdio these must refuse cleanly with an `unsupported_in_stdio` error;
  that refusal is itself a test case.
- On a Worker without Images enabled, the error should name the missing
  binding and suggest the in-isolate alternative.
- On a Worker with Images: each op consumes one unique transformation from
  your monthly allowance per call. The free plan includes 5,000 per month and
  then returns errors (no overage billing); the paid Images plan lifts the
  cap. Test each op once rather than looping.

## 5. Memory round-trip (free)

Run these in order against one transport; the point is persistence across
calls.

1. `limner_record` a note with a distinctive word and a category.
2. `limner_recall` by that word: the entry comes back, with count.
3. `limner_recall` filtered by the category; then `limner_list_categories`
   shows the category with a count of at least one.
4. `limner_record` again with the same `sourceId`: the entry updates instead
   of duplicating (upsert semantics).
5. `limner_forget` by id; a final `limner_recall` confirms it is gone.
   Forgetting the same id twice is a no-op, not an error.

Project context, same idea:

1. `limner_record_project_note` against a project name.
2. `limner_list_projects` finds the project by substring.
3. `limner_get_project_context` returns the project with your note in the
   recent list.

If you applied the example seed (`pnpm setup:cloudflare --with-example-seed`),
`limner_recall` with the query `aurora` and `limner_list_categories` give you
instant material to poke at.

## 6. Paid generators (your API credit; run last)

Each successful call spends real money on your provider account. One image
per check is enough.

`limner_generate_dalle` (OpenAI):

- Generate one square image from a short prompt. Confirm you get image data
  back, not a URL that 404s.
- With no `OPENAI_API_KEY` set, the error should say the secret is missing,
  not stack-trace.

`limner_generate_recraft` (Recraft):

- Generate one image in a raster style, and optionally one in a vector style.
- Same missing-key check as above with `RECRAFT_API_KEY`.

## Reporting

- Capture the `limner_version` output once per session; every template asks
  for it.
- Workers HTTP logs: `pnpm --filter @limner/mcp exec wrangler tail` while you
  reproduce. Stdio: the server's stderr is the log.
- Strip keys and tokens from anything you paste.
- One finding per issue. "Works as documented" findings are valuable too;
  they tell us what not to investigate.

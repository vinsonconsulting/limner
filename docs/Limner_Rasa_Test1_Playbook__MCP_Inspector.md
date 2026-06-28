# Test 1 Playbook — MCP Inspector

The schema-and-OAuth gate for a limner deployment. MCP Inspector connects directly
to the MCP endpoint, drives the OAuth 2.1 flow, and lists the tools, prompts, and
resources so you can confirm the surface before any other client touches it.

This validates the **live surface**, so it runs against a deployed Worker, not stdio.

## Surface under test

A v1 deployment exposes **18 tools, 12 prompts, 3 resources**. Inspector talks to the
server directly, so it lists tools under their **`limner_`-prefixed** registered names.

> Note: the Claude Managed Agent (Test 4) surfaces these same tools under **bare** names
> (`upscale`, not `limner_upscale`) because the prefix is stripped when they are attached
> as agent skills. Every direct or bridged MCP client — Inspector, MCPJam, Claude Desktop,
> LobeChat, TypingMind — sees the prefixed names. Expect the prefix here.

## Prerequisites

- Node ≥ 22.13 and `npx`.
- MCP Inspector ≥ 0.21.2 (`npx @modelcontextprotocol/inspector` pulls latest).
- A deployed, OAuth-gated target. Default to **dev**; fall back to **prod** only if needed.

| Target | MCP endpoint | OAuth metadata |
| --- | --- | --- |
| dev (primary) | `https://mcp-dev.limner.us/mcp` | `https://mcp-dev.limner.us/.well-known/oauth-authorization-server` |
| prod (fallback) | `https://mcp.limner.us/mcp` | `https://mcp.limner.us/.well-known/oauth-authorization-server` |

OAuth is dynamic client registration (RFC 7591) + PKCE (S256). On **dev** every client
sees the consent screen (the dev trusted-redirect list is empty by design), so dev is the
right place to exercise consent. On **prod** the first-party agent's redirect is trusted and
auto-approves; an Inspector DCR client is not trusted, so it still gets the consent screen.

## Connect — GUI (drives OAuth + consent)

1. `npx @modelcontextprotocol/inspector` — opens `http://localhost:6274`.
2. Transport **Streamable HTTP**; URL `https://mcp-dev.limner.us/mcp`; **Connect**.
3. A browser tab opens the **consent screen** ("Authorize access — Limner MCP", scope `mcp`).
   Click **Approve**. Inspector receives the code on its loopback callback (`:6274`), exchanges
   it for a bearer token, and connects.
4. Confirm **Deny** also works: it returns an `access_denied` error and does not connect.

## Connect — CLI (listing without the browser flow)

The CLI is the quickest way to snapshot schemas, but it needs a bearer token (the GUI does
the OAuth; the CLI does not). With a token in hand:

```
npx @modelcontextprotocol/inspector --cli https://mcp-dev.limner.us/mcp \
  --header "Authorization: Bearer <token>" --method tools/list
```

Repeat with `--method prompts/list` and `--method resources/list`.

## What to verify

**Tools — 17, prefixed:**
`limner_generate_dalle`, `limner_generate_midjourney`, `limner_generate_recraft`,
`limner_upscale`, `limner_vectorize`, `limner_compose`, `limner_recall`, `limner_record`,
`limner_forget`, `limner_list_categories`, `limner_list_projects`,
`limner_get_project_context`, `limner_record_project_note`, `limner_health`,
`limner_version`, `limner_list_pipelines`, `limner_pipeline_capabilities`.

Each tool lists with a non-empty input schema (Inspector renders the form fields).

**Prompts — 12:** capability-tour, pipeline-router, brand-stamp, multi-size-export,
captioned-graphic, aspect-ratio-crops, style-from-images, vectorize, midjourney-builder,
dalle-builder, recraft-builder, illuminated-manuscript.

**Resources — 3:** `limner://reference/file-types`, `limner://reference/external-tools`,
`limner://reference/print-ready`. Read one and confirm it returns text content.

## Representative execution

Run a tool end-to-end. A free, deterministic choice is `limner_health` (returns bindings
flavor, `hasImages`, and the version) or `limner_version`.

To confirm **signed artifact delivery**, call a tool that re-hosts to R2 — a paid generator
(`limner_generate_dalle`) or a transform (`limner_upscale` / `limner_vectorize` on an image URL).
The returned URL is under `/artifact/generated/...` and, on a public https target, carries
`?exp=<epoch>&sig=<...>` (a signed, expiring capability URL); fetch it once to confirm it returns
the bytes, not a 404 or 403. Note: `limner_compose` returns image bytes **inline** (not a URL),
and `limner_generate_recraft` returns Recraft's **provider** URL — neither yields a Limner signed
artifact URL.

## Pass criteria

- [ ] 18 tools / 12 prompts / 3 resources list, with the prefixed tool names above.
- [ ] Each tool shows an input schema; each resource reads.
- [ ] The OAuth **consent screen** appears; **Approve** connects; **Deny** is refused.
- [ ] A representative tool executes and returns a result; an artifact-producing call returns
      a working signed artifact URL.

## Troubleshooting

- **Consent Approve doesn't connect / hangs.** Until #109 this was a *server* bug: the consent
  page's CSP (`form-action 'self'`) blocked the post-approve redirect to the client's redirect_uri
  in Chromium (the POST aborted with `net::ERR_ABORTED`), so the code never reached the client. The
  fix — the CSP now allows the validated redirect origin — is deployed dev + prod, so Approve
  completes normally. If you still see a hang on an up-to-date deployment, snapshot schemas via the
  CLI leg with a bearer token while you investigate the client.
- **401 on `/mcp` with no token.** Expected — the endpoint is OAuth-gated. Complete the flow.
- **Token-but-no-tools.** Confirm the `Mcp-Session-Id` from `initialize` is carried on subsequent
  calls; the server is one Durable Object per session.

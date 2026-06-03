# `vault_ids` 0-token failure — Findings, Root Cause & Fix

> **Date:** 2026-06-03 · **Status:** ✅ **RESOLVED — root cause proven and fix verified end-to-end** · **Author:** Claude Code
>
> This document supersedes two earlier wrong conclusions (a prior research report's, and an earlier version of *this* doc). The truth was nailed only by an end-to-end billable reproduction. The original research report is preserved verbatim at [vault-ids-investigation-report.md](vault-ids-investigation-report.md).

---

## TL;DR

The bug — a Managed Agents session with `vault_ids` failing immediately with `model_request_failed_error` / "An internal service error occurred." / `retry_status: exhausted` / **0 tokens** — was caused by **the `compose` tool's input schema, which is `{type:"object", oneOf:[…16 ops…]}`**. The Anthropic Messages API **rejects a top-level `oneOf`/`anyOf`/`allOf`** in a tool `input_schema`. Managed Agents masks that clean `invalid_request_error` as an opaque `model_request_failed_error`.

It only fired under `vault_ids` because that's the **only path that loads limner's tools** into the model request (authenticated MCP connection → `tools/list` succeeds → tools loaded → invalid model request).

**Fixed** in `toMcpInputSchema` (flatten the union; PR #8, branch `fix/compose-toplevel-oneof`), **deployed**, and **re-verified end-to-end**: the same `vault_ids` session that died at 0 tokens now runs to `agent.message` with tokens spent.

---

## The arc (two wrong turns, honestly)

1. **Original research report → `[SPECULATION]`: an Anthropic-side `mcp_oauth` credential-resolution/refresh defect.** Plausible from docs alone (vault resolution is orchestration-side), but **wrong**: the credential is `valid`, refresh succeeds, and the failure has nothing to do with credential resolution.
2. **First reconciliation (this doc's earlier version) → client-side `Mcp-Session-Id` transport bug, "fixed by 6c."** Built on the 6b commit's framing. Also **wrong**: 6c deployed to prod and the bug *still reproduced* with a valid credential. 6c is a correct transport fix, but it's not *this* fix — ironically it **exposed** the bug by making `tools/list` succeed so the tools actually load.
3. **End-to-end billable verification → the truth.** Reproducing the exact scenario on fixed infra, then bisecting with a control and the raw Messages API, isolated the real cause: the `compose` tool schema.

**Lesson:** neither armchair hypothesis could see the cause because it lives in a layer only a real model request exercises — the *loaded tool schemas*. Verification beat speculation.

---

## Proven root cause

`compose` is a single tool over a `z.discriminatedUnion('op', […])` ([compose.ts](../packages/limner-mcp/src/tools/compose.ts)). `toMcpInputSchema` ([server.ts](../packages/limner-mcp/src/server.ts)) wrapped that as `{type:"object", oneOf:[…]}` to satisfy MCP's "must be `type:object`." But:

- **Plain Messages API, `oneOf` tool schema →** `invalid_request_error: "tools.0.custom.input_schema: input_schema does not support oneOf, allOf, or anyOf at the top level"`.
- **Standard / flattened / nested-`oneOf` tool schemas →** HTTP 200.

Only `compose` (of 15 tools) had a top-level combinator. When `vault_ids` authenticates the MCP connection on 6c, `tools/list` returns 200, `compose` loads into the model request, and the request is invalid — surfaced through Managed Agents as the opaque 0-token `model_request_failed_error`.

### The decisive asymmetry (one self_hosted environment, same agent, seconds apart)

| Session | MCP connection | Tools loaded? | Result | Tokens |
|---|---|---|---|---|
| **`vault_ids`** (`sesn_01A7fX…`) | authenticated (valid cred) | **yes** → invalid `compose` schema | `model_request_failed_error` / "internal service error" | **0 / 0** ✗ |
| **control, no `vault_ids`** (`sesn_01JjXn…`) | unauth → `mcp_authentication_failed_error` (graceful, documented) | no | `agent.message`, completed | 3 / 5 ✓ |

Every working case has limner's tools *absent*; the one failing case is the only one that loads them. (6b "worked" because its `tools/list` 400 stopped the load; the control works because auth fails.)

---

## The fix (PR #8 — verified)

`toMcpInputSchema` now **flattens** a top-level union into a single object: union every variant's properties, collapse the discriminator's `const`s into an `enum`, require only the cross-variant intersection (`op`). **Validation is unchanged** — `registerTools` still `safeParse`s the zod `discriminatedUnion` at call time, so only the *advertised* schema is loosened, never what's *accepted*. Added `test/tool-schemas.test.ts` to fail the build if any tool advertises a top-level combinator.

**Verification:**
- Generated `compose` schema (16-op `enum`, 24 props, `required:["op"]`, no top-level combinator) → `POST /v1/messages` **200**.
- Prod redeploy (version `d1621215`) → new `vault_ids` session `sesn_011qZh…`: `agent.message` "ready. I can see **17 tools**", **3 in / 18 out tokens**, **no `model_request_failed_error`**. Bug gone.

---

## Anthropic-side feedback (narrow, legitimate)

Not a credential defect. The real Anthropic-side gap is **error masking**: the same condition that returns a crisp `invalid_request_error: "input_schema does not support oneOf … at the top level"` on the raw Messages API surfaces through Managed Agents as an opaque `model_request_failed_error: "An internal service error occurred."` with 0 telemetry. That masking is what sent two investigations chasing the wrong layer; surfacing the underlying validation error (and/or having the MCP connector adapt top-level-combinator MCP schemas) would have made this a five-minute diagnosis. Optional to file; include `request_id req_011CbgJz5zbX54aN9vYtgYRV` (failing session create).

## What the original report got right vs wrong

- **HOLDS (verified against live docs):** runtime-only credential validation; the *documented* graceful degrade (`mcp_authentication_failed_error`) — which the control reproduced exactly; immutability of `mcp_server_url`/`token_endpoint`/`client_id`; `vault_ids` semantics; self-hosted carve-out = Memory; ship dates (May 6 `mcp_oauth` refresh, May 19 self-hosted) verified verbatim.
- **WRONG:** the lead `[SPECULATION]` (Anthropic `mcp_oauth` refresh defect). The contradiction it correctly identified (documented-recoverable vs observed-fatal) was real — but the cause was a client tool schema, not credential resolution. It couldn't see that without the tool schemas + a live model request.

## Follow-ups

- **Path A (`@limner/cma-tools`) lockstep:** shares the same `compose` zod schema; dormant (agent uses Path B per D-RA-12) but will need the same flattening (via the CMA template's zod→JSON conversion, or by flattening the source schema) before activation. PR #8's fix is Path B only.
- **6c (PR #7):** keep — it correctly fixes the `Mcp-Session-Id` transport so `tools/list` returns 200 (regression-guarded by `test/worker.handshake.test.ts`). Independent of this bug.
- **Optional:** file the Anthropic error-masking feedback above.

## Evidence log

- Env `env_01Ta5kRYQRWoT3niAxtjQoUr` (self_hosted) · Agent `agent_019reJew5g86XrxMg5MSBqGf` (sonnet-4-6, `mcp_servers[].url` = prod) · Vault `vlt_011CbZ6BnEJ8SnZuTCo3R94g` · Credential `vcrd_01XQcgFQZq5B6k7NpETihG89` (`mcp_oauth`, URL byte-match, `valid`).
- Prod MCP: `https://limner-mcp-production.jim-170.workers.dev/mcp` (version `d1621215` post-fix).
- Failing `vault_ids` session `sesn_01A7fXb2zbhPwhqV7CKa73rS` (create `req_011CbgJz5zbX54aN9vYtgYRV`). Control `sesn_01JjXnnfUwvHiC81babV5TFk`. Post-fix `sesn_011qZhPvmjkNvGmYzjNTxf1N`.
- Live docs verified 2026-06-03: `platform.claude.com/docs/en/managed-agents/{vaults,self-hosted-sandboxes,sessions}`, `release-notes/overview`.

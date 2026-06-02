# `vault_ids` 0-token failure — Findings Review & Reconciliation

> **Date:** 2026-06-02 · **Author:** Claude Code (desk review, no billable diagnostics run) · **Status:** Final — §2 aligned to the provided report ([vault-ids-investigation-report.md](vault-ids-investigation-report.md))
>
> **Scope:** Audits a prior research report's conclusion against (a) the live Anthropic Managed Agents docs and (b) this repo's actual config and commit history. Produced under the "reconcile & correct" / desk-only decision — nothing billable, standing, or destructive was executed.

---

## TL;DR — the correction

The report's lead conclusion — *an undocumented Anthropic-side defect in the orchestration `mcp_oauth` credential-resolution/refresh path*, which the report itself appropriately tagged `[SPECULATION]` — **is superseded by this repo's own commit history.**

- **Root cause is client-side**: `limner-mcp`'s stateless Streamable-HTTP transport couldn't hold `Mcp-Session-Id` across the MCP `initialize → notifications/initialized → tools/list` handshake. With a *valid* credential injected via `vault_ids`, the request reached that handshake and died *before the model ran* → `model_request_failed_error`, 0 tokens, `retry_status: exhausted`.
- **It's already mitigated**: commit `206f07c` (Jun 1) ships a fixed-`sessionIdGenerator` workaround; the durable McpAgent + Durable Object fix is built on branch `phase-6c-mcpagent`.
- **Do not file the Anthropic "refresh defect" ticket.** The credential was never the problem (the report's own `mcp_oauth_validate = valid` proves it).
- **Recommended decision:** land Phase 6c, retire the 6b stopgap. (§5)

---

## 1. What actually happened (corrected root cause)

`limner-mcp`'s `/mcp` endpoint is OAuth-gated (`OAuthProvider`, per D-RA-06). That gate is the whole explanation for the asymmetry the report found mysterious:

| Session config | Anthropic → Limner MCP | Result | Tokens |
|---|---|---|---|
| **No `vault_ids`** | connects **unauthenticated** → 401 at the OAuth gate | documented graceful degrade: `session.error: mcp_connection_failed_error`, session continues | real usage (the "control") |
| **With `vault_ids`** | valid bearer injected → **passes** the gate → into the MCP handshake | stateless transport can't satisfy `Mcp-Session-Id` correlation → fatal **before** the model dispatches | **0 / 0 / 0**, `retry_status: exhausted` |

`vault_ids` is simply the gate key that lets the request reach the buggy handshake. Remove the key and the request never gets far enough to trip it.

**Evidence (this repo):**
- `206f07c` — `packages/limner-mcp/src/worker.ts:95-97`: `sessionIdGenerator: undefined` → `() => 'limner-mcp-session'`. Commit message: *"Per-request Transport with sessionIdGenerator returning a fixed string unblocks Anthropic Managed Agents `model_request_failed_error` when `vault_ids` are attached. Stateless transport … couldn't satisfy Mcp-Session-Id correlation across the initialize → notifications/initialized → tools/list handshake."*
- `packages/limner-mcp/src/worker.ts:61-81` (comment) adds: module-scope caching also caused stale-session bugs across Anthropic sessions; per-request construction with a fixed id sidesteps both.
- Branch `phase-6c-mcpagent`: `LimnerMCP extends McpAgent`, one Durable Object per `Mcp-Session-Id`, `new_sqlite_classes` migration `v1` (redeclared for the production env). Its own header comment cites `206f07c` and states it "replaced [the workaround] wholesale," restoring `tools/list`.

**Why the report's own evidence undercuts its hypothesis:** it reports `mcp_oauth_validate` returning `valid`. A valid credential means resolution/refresh worked — so the failure is *downstream of auth*, in the transport handshake, exactly where the commit places it. "Valid credential" is consistent with the client-side cause and inconsistent with a refresh-path defect.

---

## 2. Findings Review — claim-by-claim (keyed to the report)

Audited against the report as provided ([vault-ids-investigation-report.md](vault-ids-investigation-report.md)) and the live docs. **The report is well-calibrated and was not confabulated:** it tags its mechanistic root-cause `[SPECULATION]`, states explicitly "do not present the mechanism to stakeholders as confirmed," and prescribes the exact debugging (cloud-vs-self_hosted control, `mcp_oauth_validate`) that would falsify it. It was sound doc-based research with no visibility into `limner-mcp`'s transport code — which is precisely where the real bug lived.

Verdict key: **HOLDS** (verified) · **HOLDS/DRIFT** (true, with a correction) · **SUPERSEDED** (overtaken by commit `206f07c`) · **UNVERIFIED** (external claim I did not independently confirm) · **OPEN** (unresolved).

| Report claim | Report's tag | Verdict | Evidence |
|---|---|---|---|
| TL;DR: not a documented/public known bug; no documented limitation makes `vault_ids` unsupported/partial on self_hosted (only Memory carve-out) | — | **HOLDS** | release notes + self-hosted doc; no such limitation exists |
| TL;DR: the hard failure contradicts "not validated until runtime / never blocks the session" | — | **HOLDS** | vaults doc, verbatim — the contradiction is real |
| TL;DR: "most consistent with a beta defect in the orchestration-side … `mcp_oauth` auto-refresh path" | implicit hypothesis | **SUPERSEDED** | `206f07c` fixed it by changing the MCP transport session-id, not the refresh path; `mcp_oauth_validate = valid` |
| A1: only self-hosted carve-out is Memory | [DOCUMENTED] | **HOLDS** | self-hosted doc: "Memory … is not currently supported"; release notes |
| A2: vault resolution/injection is Anthropic orchestration-side, not an operator responsibility | [DOCUMENTED] | **HOLDS** | self-hosted doc + security model |
| A3: Pluto Security — credential proxy outside the sandbox; sandbox never sees the token | [REPORTED] | **UNVERIFIED** (consistent) | external blog not re-fetched; aligns with docs/architecture |
| A4: on self-hosted, vaults supported but "MCP-only", proxied server-side (Daytona; anthropics/skills Pattern 9) | [DOCUMENTED] | **HOLDS** (substance) | matches vaults-doc behavior; specific partner quotes not re-fetched |
| A4-interp: failure surfaces upstream of model + MCP because resolution is orchestration-side | [SPECULATION] | **SUPERSEDED** | the agent reached the MCP handshake (post-auth); the failure is in the client transport, not orchestration resolution |
| B1: no known-issue artifact in any public tracker/changelog/status | [REPORTED] | **HOLDS — verified** | ran 2 issue searches (vault/credential/self_hosted/"internal service error"; model_request_failed/mcp_oauth/Mcp-Session-Id/vault_ids) → **0 results**, closing the report's B-caveat |
| B2: Cloudflare control plane explicitly pre-release/alpha | [DOCUMENTED] | **HOLDS** (per report) | README not re-fetched; consistent with your build-on-template |
| B3: `mcp_oauth` background refresh shipped **May 6 2026**; self-hosted sandboxes **May 19 2026** | [DOCUMENTED] | **HOLDS — verified verbatim** | release notes: May 6 "vault credential background refresh … for `mcp_oauth`"; May 19 "Self-hosted sandboxes are now available" |
| C1: exact-URL mismatch is a recoverable runtime error, not a fatal pre-model one | [DOCUMENTED] | **HOLDS** | vaults/mcp-connector docs; also moot — the handshake was reached, so the URL matched |
| C2: `mcp_server_url`/`token_endpoint`/`client_id` immutable | [DOCUMENTED] | **HOLDS** | vaults doc: "locked after creation" |
| C3: no public case of URL-edge → fatal; escalation-to-fatal is speculative | [REPORTED]/[SPEC] | **HOLDS** (and not the cause) | honest; commit shows the cause is unrelated to URL matching |
| D1: Anthropic runs OAuth refresh; credentials re-resolved periodically | [DOCUMENTED] | **HOLDS** | vaults doc + May 6 release note |
| D2: `mcp_oauth_validate` returns `refresh`/`mcp_probe`; statuses; `refresh_failed` webhook exists | [DOCUMENTED] | **HOLDS/DRIFT** | verified; endpoint is `?beta=true`, status `valid\|invalid\|unknown`, id prefix `vcrd_` |
| **D3: lead mechanism — an `mcp_oauth` refresh throw, uncaught by the graceful path, propagates as a 0-token `model_request_failed_error`** | [SPECULATION] | **SUPERSEDED (decisive)** | the fix was `sessionIdGenerator: undefined → fixed string` on the MCP server; a refresh-path defect would *not* be cured by changing MCP transport session-id |
| Key finding: "provider logs show **zero requests reaching the MCP server**" | environment evidence | **OPEN** | if accurate, this resists the pure client-side story; needs a fresh repro + Cloudflare logs (Asana #3) |
| Caveats: mechanism is speculation; absence-of-evidence ≠ behaves-as-documented; re-verify weekly | — | **HOLDS / commend** | exactly right — this calibration is why the report stays trustworthy even though its lead guess was wrong |

**Net:** every **[DOCUMENTED]** claim holds (several verified verbatim, incl. the May 6 / May 19 dates). Every **[SPECULATION]** claim — the Anthropic-side `mcp_oauth` refresh mechanism (A4-interp, C3, D3) — is **superseded** by commit `206f07c`, whose fix is the clean falsification: *a refresh defect would not be cured by changing the MCP transport's session-id.* The lone **OPEN** item is the report's "zero requests reached the MCP server," which is exactly why Asana follow-up #3 exists.

---

## 3. Recommendation investigation (the report's six)

| # | Recommendation | Applies here? (evidence) | Class | What you'd see |
|---|---|---|---|---|
| 1 | Remove `vault_ids`; inject MCP secret host-side via a custom tool | **Already the architecture for pipeline creds** (Cloudflare Secrets + outbound proxy, arch §3.3). But the `vault_ids` here carried the *agent→MCP OAuth bearer* for the Path B dogfood, not a pipeline secret. Moving to host-side = the Path A model Limner defers (D-RA-12) | already-architecture / wrong layer | Sidesteps `vault_ids` (and thus the bug) but abandons the Path B dogfood and fixes the wrong layer |
| 2 | Reproduce on a `cloud` env to isolate self_hosted-specificity | MCP connect + vault injection are orchestration-side **regardless of env type** (self-hosted doc). The bug is in Limner's server transport — identical on cloud or self_hosted | needs-confirm, **billable, unnecessary** | Would fail on both — but because of the transport, not the refresh path the report predicted |
| 3 | Call `mcp_oauth_validate`; capture `status`/`refresh`/`mcp_probe` | Cheap, real; in the self-run script (§6) | safe-now (user-run) | Expected `valid` — which points *away* from the report's hypothesis |
| 4 | Subscribe `vault_credential.refresh_failed` webhook | Webhook is real; refresh isn't this failure mode. Good prod hygiene, not diagnostic of this bug | needs-confirm (standing sub), optional | No `refresh_failed` events for this failure |
| 5 | Cloudflare egress secret injection instead of `vault_ids` | Same as Rec 1 — already Limner's pipeline-cred architecture; bypasses the orchestration vault path, but the bug isn't in that path | already-architecture | Bypasses the vault path; doesn't address the transport |
| 6 | Escalate with the failing `request_id` | Re-scope: don't escalate a "refresh defect." If escalating, file the narrowed observability item (§7) with a captured `request_id` | needs `request_id` (not captured) | Depends on Anthropic |

---

## 4. Workaround status & the durable fix

- **Shipped stopgap (6b, `206f07c`, on `main`):** fixed `sessionIdGenerator`. *Unblocks* the 0-token failure (sessions with `vault_ids` now spend tokens). **Trade-off:** `tools/list` still returns HTTP 400 → Anthropic degrades via `mcp_connection_failed_error` and infers tool schemas from the agent definition's `mcp_servers` array, so `tools/call` still routes. Functional, with degraded discovery.
- **Durable fix (6c, `phase-6c-mcpagent`, built, unmerged):** `McpAgent` + Durable Object keyed on `Mcp-Session-Id` → transport state persists across the handshake → restores native `tools/list`. Code + wrangler config reviewed and look complete/correct. **Not yet verified against a live MA session** (the one remaining billable check — see §5/§8).

---

## 5. The decision (recommendation)

> **Land Phase 6c (McpAgent + Durable Object); retire the 6b fixed-session-id workaround.**

- Root cause is client-side and fully addressed by 6c; no Anthropic dependency blocks shipping.
- 6c restores `tools/list` (the residual 6b leaves at HTTP 400), so the agent sees tools natively instead of via inferred schemas.
- **Gate before merge (user-run, billable):** deploy 6c → create a session **with** `vault_ids` → confirm tokens spend **and** `tools/list` → 200. Keep 6b on `main` until that passes.
- **Fallback if deferring:** keep 6b (functional via inferred schemas) and schedule 6c. Either way — **do not file the original refresh-defect ticket.**

---

## 6. Self-run diagnostic script (not executed here; secrets via env only)

```bash
# Fill via env — NEVER inline secrets. The agt_/env_/vlt_/vcrd_ IDs are NOT secret.
export ANTHROPIC_API_KEY=...                        # required; unset in the review shell
export ENVIRONMENT_ID=env_01Ta5kRYQRWoT3niAxtjQoUr  # found in shell history; confirm type below
export VAULT_ID=vlt_...                              # from your out-of-band setup
export CREDENTIAL_ID=vcrd_...                         # NOTE prefix vcrd_, not cred_
H=(-H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" -H "anthropic-beta: managed-agents-2026-04-01")

# 1) mcp_oauth_validate — DOC-CONFIRMED endpoint (note ?beta=true). Expect status:"valid".
#    A valid result is CONSISTENT with the client-side cause; it does NOT clear it.
curl --fail-with-body -sS -X POST \
  "https://api.anthropic.com/v1/vaults/$VAULT_ID/credentials/$CREDENTIAL_ID/mcp_oauth_validate?beta=true" "${H[@]}" | jq .

# 2) Confirm env type / credential auth.type / URL byte-match.
#    VERIFY these GET-by-id paths against `ant beta --help` or the API reference before running
#    (not directly doc-confirmed in this review):
#      ant beta:environments retrieve --id "$ENVIRONMENT_ID"     # -> .config.type == self_hosted
#      ant beta:vaults:credentials retrieve ...                   # -> .auth.type == mcp_oauth, .auth.mcp_server_url
#    Then byte-compare credential.mcp_server_url vs the agent's mcp_servers[].url:
#      differences in trailing slash, /mcp vs /sse, scheme (http/https), host, or case.
#    Per docs a mismatch DEGRADES to unauthenticated (recoverable) — it is NOT the 0-token fatal.

# 3) Public issue tracker — closes the report's GitHub gap (CONFIRMED command).
curl -sS "https://api.github.com/search/issues?q=repo:cloudflare/claude-managed-agents+state:all+vault+OR+credential+OR+self_hosted+OR+%22internal+service+error%22&per_page=50" \
  | jq '.items[]? | {number,title,state,html_url}'

# 4) Capture the failing request_id (none in repo). Re-run the repro with SDK debug logging or
#    response-header capture; grab the request-id header on the failing POST /v1/sessions.
#    Required for any Anthropic escalation (§7).
```

---

## 7. Corrected, OPTIONAL Anthropic feedback payload

File **only** if you want to push Anthropic on the error surface — not as a refresh-defect report.

> **Summary:** Under `managed-agents-2026-04-01`, attaching `vault_ids` with a **valid** `mcp_oauth` credential to a session whose agent declares an MCP server that fails the `initialize → tools/list` handshake produced an opaque `model_request_failed_error` (0 input / 0 output / 0 cache tokens, `retry_status: exhausted`) **before the model ran** — instead of the documented graceful `mcp_connection_failed_error` degrade that the unauthenticated path (no `vault_ids`) receives for the same server.
>
> **Contradiction:** docs state a credential/MCP-auth problem "is emitted but does not block the session from continuing." Observed behavior with a valid credential + a failing post-auth handshake was a hard, pre-model, zero-telemetry failure.
>
> **Requests:** (a) confirm whether the 0-token fatal is intended for post-auth MCP-handshake failures; (b) surface richer telemetry / a `request_id` on these sessions so client-side MCP issues are diagnosable.
>
> **Attach:** `request_id` (capture via §6 step 4); `mcp_oauth_validate` output (expected `valid`); exact repro (agent with OAuth-gated `mcp_servers[]` + `vault_ids` → fails; same without `vault_ids` → degrades gracefully).

Blocking on nothing — Phase 6c fixes our side regardless.

---

## 8. Open items

- **C11 discrepancy** — the report's "zero requests reached the MCP server." Resolve with a fresh repro capturing `request_id` + Cloudflare-side request logs to confirm client-handshake vs. any Anthropic pre-dispatch abort. (Asana #3)
- **Verbatim §2 alignment** — pending the user's report file.
- **6c live verification** — the one billable check that empirically proves the fix (§5 gate).

---

## Appendix — live-doc verification log (fetched 2026-06-02)

- `platform.claude.com/docs/en/managed-agents/vaults` — runtime-only validation + non-blocking bad token; `mcp_server_url`/`token_endpoint`/`client_id` locked after creation; `mcp_oauth_validate?beta=true` → `vault_credential_validation` {`status` valid/invalid/unknown, `mcp_probe`, `refresh`}; example credential id `vcrd_01ABC…`; `vault_credential.refresh_failed` webhook; "first vault with a match wins"; unauthenticated-on-no-credential.
- `platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes` — orchestration stays Anthropic-side, tool execution on operator worker; **Memory not supported** in self-hosted.
- `platform.claude.com/docs/en/release-notes/overview` — **verified verbatim:** May 6 2026 "vault credential background refresh … for `mcp_oauth` credentials"; May 19 2026 "Self-hosted sandboxes are now available for Claude Managed Agents" + MCP tunnels research preview; Managed Agents public beta Apr 8 2026 (`managed-agents-2026-04-01`).
- `github.com/cloudflare/claude-managed-agents` — exists, pushed 2026-06-01 (issue search is §6 step 3, user-run).
- Repo: `206f07c` (6b workaround), `phase-6c-mcpagent` (durable fix), `docs/Limner_Cloudflare_CMA_Architecture.md` D-RA-12 / D-RA-15 / §3.3, `packages/limner-mcp/wrangler.toml` (prod resources provisioned 2026-05-26).

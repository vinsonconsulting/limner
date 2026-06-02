# Investigation: `vault_ids`-Triggered `model_request_failed_error` on Self-Hosted Claude Managed Agents

## TL;DR

- **This is NOT a documented or publicly-reported known bug, and Track A resolves clearly: there is no documented limitation making `vault_ids` unsupported or partial on `self_hosted` environments** (the only documented self-hosted carve-out is Memory). But the platform's "brain-on-Anthropic / hands-on-provider" architecture explains *why* a vault-resolution failure would fire exactly where you see it — upstream of the model and upstream of MCP dispatch — because vault credential resolution and `mcp_oauth` token refresh run on Anthropic's orchestration side, never on your worker.
- **The observed hard failure contradicts the documented "credentials are not validated until runtime and never block the session" semantics**, which describe only the *graceful* degradation path. A pre-model `model_request_failed_error` with 0 tokens triggered solely by `vault_ids` presence is therefore an **undocumented anomaly** most consistent with a beta defect in the orchestration-side credential-resolution/refresh step — specifically the `mcp_oauth` auto-refresh path Anthropic runs on your behalf.
- **Best action now:** drop `vault_ids` from the self-hosted session and inject the MCP secret host-side via a custom tool (Anthropic's own documented self-hosted pattern); separately reproduce on a `cloud` environment to confirm it is self_hosted-specific; run `mcp_oauth_validate` to capture the refresh outcome; then file a support ticket with the failing `request_id` — only Anthropic can confirm the orchestration-side root cause.

## Key Findings

- **Lead hypothesis (A) answered:** No documented or reported limitation ties vault credential resolution to self-hosted environments. To the contrary, multiple sources confirm vault resolution is **architecturally independent of where the sandbox runs** — it is proxied server-side by Anthropic, and "your sandbox is not in the path."
- **The contradiction is real and mechanistically explainable:** the documented recoverable path (`session.error` / `mcp_authentication_failed_error` at runtime) and your observed fatal path (`model_request_failed_error`, 0 tokens, pre-model) are different code paths. Your provider logs showing **zero requests reaching the MCP server** corroborate that the orchestrator dies before the MCP handshake — consistent with a failure during orchestration-side credential resolution/refresh, not during MCP dispatch.
- **No known-issue artifact exists** in any public GitHub tracker, Anthropic changelog/release note, or status incident for this exact failure.
- **The feature combination is very new and explicitly pre-release**, raising the prior probability of an unreported beta defect.
- **`mcp_oauth` (not `static_bearer`) is the relevant differentiator:** only OAuth credentials exercise the Anthropic-run token-refresh path that can fail before the model runs.

## Details

### TRACK A — `vault_ids` × `self_hosted` interaction (lead hypothesis)

**A1. [DOCUMENTED] The only documented self-hosted feature carve-out is Memory; nothing analogous exists for vaults.** The self-hosted-sandboxes doc states: "Memory is not yet supported with self-hosted sandboxes." Daytona's official Managed Agents guide states the same carve-out verbatim ("Claude Managed Agents memory stores are not yet supported") and, critically, the opposite for vaults (see A4). There is **no documented statement** that vaults, `vault_ids`, or credential injection are unsupported, partial, or behave differently on `self_hosted`. Sources: platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes; daytona.io/docs/en/guides/claude/claude-managed-agents. *(self-hosted-sandboxes doc, current as of access date.)*

**A2. [DOCUMENTED] Vault credential resolution/injection is an Anthropic orchestration-side responsibility, not a worker-side one.** Self-hosting "keep[s] the orchestration on Anthropic's side but move[s] tool execution into infrastructure you control." The security-model page enumerates the operator's responsibilities under the shared-responsibility model — container image quality, network egress, the `ANTHROPIC_ENVIRONMENT_KEY`, isolating untrusted workloads, tool-execution blast radius, and log retention — and **vault/credential injection is not among them**. Anthropic states it "secures the control plane across all environments: session and work queue integrity, multi-tenant isolation, and agent-context minimization." This places vault resolution firmly in the layer Anthropic owns, the same layer that drives model invocation. Sources: platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes; platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security.

**A3. [REPORTED] Independent security research confirms a harness-side credential proxy that never enters the sandbox**, making resolution independent of sandbox location. Pluto Security (April 2026): "a credential proxy outside the sandbox matches the server URL against vault credentials and injects the token server-side… The sandbox never sees the credential." They quote Anthropic's engineering blog: the tokens "are never reachable from the sandbox where Claude's generated code runs." Source: pluto.security/blog/inside-claude-managed-agents; pluto.security/blog/securing-claude-managed-agents.

**A4. [DOCUMENTED] On self-hosted, vaults are explicitly supported but "MCP-only" and proxied server-side.** Daytona's official Anthropic-partner guide is the clearest primary statement: "MCP servers and Anthropic-managed vaults work on self-hosted environments without changes. The agent declares the MCP server in its `mcp_servers` list, vault-held credentials are referenced by id, and the call is proxied by Anthropic server-side. Your sandbox is not in the path." Anthropic's own skills repo (Pattern 9) reinforces it for self_hosted: "no container env vars; vaults are MCP-only; keep the secret host-side via a custom tool." Sources: daytona.io/docs/en/guides/claude/claude-managed-agents; github.com/anthropics/skills `shared/managed-agents-overview.md`.

**A4-interpretation [SPECULATION].** Because vault resolution is orchestration-side and feeds the same layer that invokes the model, a failure during resolution can surface upstream of both the model and the MCP handshake — which is exactly your fingerprint (0 tokens, no MCP request reaching the server). This is the mechanistic explanation for the documented-vs-observed contradiction; the precise internal code path is inference, not a documented fact. The architecture makes a self_hosted-specific manifestation *plausible* (the orchestration↔worker split is the newest, least-exercised seam) but **no source documents that vault resolution differs on self_hosted** — so if your cloud-vs-self_hosted control shows a self_hosted-only failure, that itself is the strongest evidence of a beta defect and is worth escalating.

### TRACK B — Known defect / changelog / status

**B1. [REPORTED] No known-issue artifact found, across all sources checked.** Searches of the `cloudflare/claude-managed-agents` repo, the Anthropic docs changelog/Claude Platform release notes, and the Claude status page surfaced **nothing** describing a `vault_ids`-attached `model_request_failed_error` (0-token, pre-model) failure. Status incidents in the April–June 2026 window concern model error rates and one billing incident (May 28, 2026, 19:04 UTC), none mentioning Managed Agents, vaults, or credential resolution. The relevant model releases for context: Opus 4.8 (May 28, 2026), Opus 4.7 (April 16, 2026), Opus 4.6 (Feb 5, 2026), Haiku 4.5 (Oct 15, 2025). Sources: status.claude.com; platform.claude.com/docs/en/release-notes/overview. **Absence of evidence is a genuine finding here, not a gap to paper over.**

**B2. [DOCUMENTED] The Cloudflare control plane is explicitly pre-release.** The `cloudflare/claude-managed-agents` README: "You should consider this repository alpha software. It is not yet stable and may contain bugs." The repo's own troubleshooting docs list only unrelated failure modes (Workers VPC QUIC fallback; "binding not available"; an orphaned `agent.custom_tool_use` causing "waiting on responses to events") — none match your symptom. Source: github.com/cloudflare/claude-managed-agents.

**B3. [DOCUMENTED] The feature combination is only weeks old.** Vault credential **background refresh for `mcp_oauth`** launched **May 6, 2026**; **self-hosted sandboxes** reached public beta per the **May 19, 2026** Claude Platform release note (MCP tunnels research preview same day). All Managed Agents calls require the `managed-agents-2026-04-01` beta header. A young, just-combined feature set materially raises the prior probability of an unreported beta defect in the `mcp_oauth`-on-self_hosted path. Source: platform.claude.com/docs/en/release-notes/overview. **[Date conflict — flagged]:** some secondary write-ups (e.g., a DEV Community guide) date the Code with Claude London conference to May 26, 2026, while several others (Digital Applied, DevToolPicks, blockchain.news) and the Anthropic release notes point to May 19, 2026. I treat the **May 19, 2026 release-note date as authoritative for when the feature shipped**; the conference-date discrepancy does not affect any technical conclusion.

**B-caveat.** The `cloudflare/claude-managed-agents` issue tracker (open + closed) could not be exhaustively enumerated with available tooling — the issues-list URL was not directly fetchable. Treat B1 for that repo as "not found via search," not "verified zero." A direct browser check of `github.com/cloudflare/claude-managed-agents/issues?q=` (terms: vault, credential, model_request_failed, self_hosted, "internal service error") is the recommended next step.

### TRACK C — Credential/URL-matching edge cases

**C1. [DOCUMENTED] Exact-URL matching failures are documented as recoverable runtime errors, not fatal pre-model ones.** "Credentials are matched by URL, so the vault must contain a credential whose `mcp_server_url` exactly matches the url declared in `mcp_servers`; if none matches, the connection is attempted unauthenticated" and "produces an error if the server requires authentication." This is explicitly a runtime `session.error` with the affected `mcp_server_name` and a `retry_status` — it does not block session creation. So a trailing-slash / `/mcp`-vs-`/sse` / host mismatch should, per docs, degrade gracefully — not produce your 0-token `model_request_failed_error`. Sources: platform.claude.com/docs/en/managed-agents/mcp-connector; platform.claude.com/docs/en/managed-agents/vaults.

**C2. [DOCUMENTED] Immutable credential fields exist that could mismatch at resolution time.** `mcp_server_url`, `token_endpoint`, and `client_id` are "locked after creation" (only the secret payload and a few metadata fields are mutable). A mismatch among these — e.g., a `token_endpoint`/`client_id` that no longer corresponds to the OAuth server — is a plausible trigger for a refresh-time throw, but **no source documents this escalating to a 0-token model failure**. Source: platform.claude.com/docs/en/managed-agents/vaults.

**C3. [REPORTED] No public case found** of a URL-matching edge, malformed credential shape, or OAuth misconfiguration producing `model_request_failed` instead of the documented recoverable runtime error. The distinction "documented to be recoverable" (C1) vs. "reported to be fatal" (no reports found) holds: there are **no reports of the fatal variant**. Any escalation-to-fatal pathway is **[SPECULATION]**.

### TRACK D — `mcp_oauth` credential type specifically

**D1. [DOCUMENTED] Anthropic runs OAuth refresh on your behalf, and credentials are re-resolved at the vault-lifecycle level — not only mid-session.** "Credentials are re-resolved periodically, both during a session and during the vault lifecycle." "Anthropic manages token refresh on your behalf." This confirms an Anthropic-side refresh actor that operates around session boundaries. Sources: platform.claude.com/docs/en/managed-agents/vaults; platform.claude.com/docs/en/managed-agents/sessions.

**D2. [DOCUMENTED] A dedicated validation endpoint proves a pre-use refresh+probe path that can fail in distinct ways.** `POST /v1/vaults/{id}/credentials/{cred_id}/mcp_oauth_validate` returns a `vault_credential_validation` object whose `refresh` sub-object reports the refresh outcome and `mcp_probe` reports the handshake. Documented refresh statuses include `no_refresh_token` and a transient `unknown` ("a transient error (5xx, 429, or network failure)"); top-level `status` can be `valid`, `invalid` ("the grant is gone or the OAuth server rejected the refresh with a 4xx"), or `unknown`. There is also a `vault_credential.refresh_failed` webhook ("MCP OAuth vault credential failed to refresh"). This is direct evidence that an Anthropic-side refresh attempt exists, runs against the stored `refresh_token`/`token_endpoint`, and **can fail**. Sources: platform.claude.com/docs/en/managed-agents/vaults; platform.claude.com/docs/en/managed-agents/webhooks.

**D3. [SPECULATION] Most plausible mechanism for your exact symptom.** An `mcp_oauth` auto-refresh attempt (orchestration-side, against the stored `refresh_token`/`token_endpoint`/`client_id`) that errors in a way **not** caught by the graceful `mcp_authentication_failed_error` runtime path, propagating upward as `model_request_failed_error` with 0 tokens and `retry_status: exhausted` before model invocation. `static_bearer` credentials have no refresh step and would not exercise this path — consistent with the failure being `mcp_oauth`-specific. This is reasoned inference from the documented refresh machinery (D1/D2); it is **not** a documented or reported defect. The fact that `mcp_oauth_validate` returns `status: valid` for your credential does not rule this out: validation runs in a different, isolated request context than the session-creation orchestration path, and a transient or context-specific refresh fault could occur in one and not the other.

## Recommendations

Staged, concrete, with the thresholds that would change them:

1. **(Strongest — Anthropic's own documented self-hosted pattern) Remove `vault_ids` from the self-hosted session and inject the MCP credential host-side via a custom tool.** Anthropic's guidance for self_hosted is explicit: "vaults are MCP-only; keep the secret host-side via a custom tool." This also matches your control (vault_ids omitted → runs to real token usage). *Threshold to revisit:* if you require Anthropic-managed OAuth auto-refresh (so you don't store/rotate the token yourself), this workaround is a stopgap, not a permanent answer — keep the ticket open.
2. **(Isolates the variable) Reproduce the identical agent + vault + MCP server on a `cloud` environment.** If it passes on cloud and fails on self_hosted → you have confirmed a self_hosted-specific orchestration bug; attach both `request_id`s to your support ticket. If it fails on both → the trigger is the credential/refresh path itself, independent of environment type, and Track D becomes the primary lead.
3. **(Diagnostic) Call `mcp_oauth_validate` and capture `status`, `refresh`, and `mcp_probe` verbatim.** A `refresh` error or `unknown`/transient status — especially alongside an otherwise `valid` token — is direct support for the Track D mechanism and is the single most useful artifact to hand Anthropic.
4. **(Operational) Subscribe to the `vault_credential.refresh_failed` webhook** so refresh failures surface out-of-band, since the in-session `model_request_failed_error` is opaque and carries 0 telemetry.
5. **(Cloudflare-specific alternative) Use the provider's own egress secret-injection (the control plane's `SECRETS` KV + egress policy) for the MCP server instead of Anthropic `vault_ids`,** bypassing the Anthropic vault-resolution path entirely. This is a different credential-injection mechanism (operator-side, at the egress proxy) and will not exercise the suspected orchestration-side refresh path.
6. **Escalate with the `request_id`** from the failing `POST /v1/sessions`. Anthropic's error envelope explicitly instructs: include the `request_id` "when reporting issues to Anthropic — it lets us trace the request end-to-end."

*What would change this assessment:* a green run on cloud + red on self_hosted confirms a self_hosted regression (push for an ETA); a red run on both points to a credential/refresh defect independent of environment; a clean `mcp_oauth_validate` with a *reproducible* session-create failure points to a context-specific orchestration fault only Anthropic can see.

## Caveats

- **Every "this is a known bug" claim came back negative.** No GitHub issue, changelog entry, release note, or status incident corroborates this exact failure. That is a real, useful result — but it is **not** proof the platform behaves as documented; it is consistent with an *unreported* beta defect, which the youth of the `mcp_oauth`-on-self_hosted combination (weeks old) makes plausible.
- **The mechanistic explanation (Tracks A4-interpretation, C3, D3) is labeled [SPECULATION] deliberately.** The architecture (orchestration-side vault resolution + an Anthropic-run `mcp_oauth` refresh that can fail) makes your symptom *coherent*, but no public source documents the specific escalation from "recoverable MCP auth error" to "fatal 0-token `model_request_failed_error`." Do not present the mechanism to stakeholders as confirmed.
- **One source-coverage gap remains:** the `cloudflare/claude-managed-agents` issue tracker could not be exhaustively enumerated via available tooling; a manual browser check is advised before declaring "zero issues."
- **Date discrepancy flagged, not hidden:** secondary sources disagree on the Code with Claude London date (May 19 vs May 26, 2026); the authoritative ship date for self-hosted sandboxes is the **May 19, 2026** Claude Platform release note. No technical conclusion depends on which conference date is correct.
- **This beta changes weekly.** All findings reflect documentation and reports current as of June 2, 2026; re-verify the release notes and the vaults/self-hosted docs before acting, as the carve-outs and refresh behavior are actively evolving.
- **Old single-container model is deprecated** and was not relied upon: all conclusions use the current brain-on-Anthropic / hands-on-provider split.

## Sources (accessed June 2, 2026)

- platform.claude.com/docs/en/managed-agents/vaults
- platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes
- platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security
- platform.claude.com/docs/en/managed-agents/mcp-connector
- platform.claude.com/docs/en/managed-agents/sessions
- platform.claude.com/docs/en/managed-agents/events-and-streaming
- platform.claude.com/docs/en/managed-agents/webhooks
- platform.claude.com/docs/en/managed-agents/overview
- platform.claude.com/docs/en/release-notes/overview
- github.com/anthropics/skills — `shared/managed-agents-api-reference.md`, `shared/managed-agents-overview.md`, `shared/managed-agents-onboarding.md`
- github.com/cloudflare/claude-managed-agents (README; `docs/securing-access.md`; `docs/connecting-to-private-services.md`)
- blog.cloudflare.com/claude-managed-agents
- developers.cloudflare.com/sandbox/tutorials/claude-managed-agents
- daytona.io/docs/en/guides/claude/claude-managed-agents
- pluto.security/blog/inside-claude-managed-agents; pluto.security/blog/securing-claude-managed-agents
- claude.com/blog/claude-managed-agents-updates
- status.claude.com
- github.com/Piebald-AI/claude-code-system-prompts — `data-managed-agents-webhooks.md` (webhook `data.type` enumeration, incl. `vault_credential.refresh_failed`)

---

> **Provenance note (added 2026-06-02 by Claude Code):** This is a verbatim copy of the prior research report, originally delivered as `~/Downloads/compass_artifact_wf-9e5977ef-40af-4f46-821e-47b86c5b65bd_text_markdown.md`, saved here for durable context. The audit, reconciliation, and corrected conclusions live in the sibling `vault-ids-findings-review.md`.

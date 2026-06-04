# Security Policy

## Supported versions

Limner is pre-v1; security fixes target the `main` branch. Once v1.0.0 ships,
this policy will name supported release lines.

| Version | Supported |
|---|---|
| `main` (pre-v1) | ✅ |

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

- Preferred: GitHub private vulnerability reporting — **Security → Report a
  vulnerability** on `vinsonconsulting/limner`.
- Or email **jim@vinson.org** with `[limner-security]` in the subject.

Include the affected component (`@limner/core` / `@limner/mcp` /
`@limner/cma-tools`), a description, reproduction steps, and impact. We aim to
acknowledge within 5 business days and to agree a disclosure timeline with you.

## Scope and deployment notes

Limner is self-deployed: you run it on your own Cloudflare account with your own
API keys, so some of the security posture is the operator's responsibility.

- **OAuth (D-RA-19).** The v1 dogfood build auto-approves any authenticated
  OAuth client (`scopesSupported: ['mcp']`, no consent screen). **Before
  exposing a deployment to untrusted clients, add a consent/authorization
  policy.** This is a documented v1 limitation, not a defect.
- **Secrets are yours.** Pipeline credentials (`OPENAI_API_KEY`,
  `RECRAFT_API_KEY`) live in Cloudflare Secrets, injected at deploy time; Limner
  never commits them to the repo or writes them to D1. Rotate on your own cadence.
- **Resource identifiers are not secrets.** The D1 `database_id`, KV `id`, and
  R2 `bucket_name` values in `wrangler.toml` are account-scoped resource
  identifiers, not credentials, and are safe to commit.
- **Rate limiting (RT-1).** The `/mcp` surface is metered per caller
  (`RATE_LIMITER`, 100 requests / 60s) and fails open if the binding is absent.
- **Artifact retention (D-RA-20).** Image artifacts in R2 are hard-deleted after
  30 days by a scheduled sweep; do not treat R2 as durable storage.

## Dependencies

Native and WASM dependencies (better-sqlite3 for local tests; Photon / jSquash /
resvg WASM for composition) are pinned via the lockfile. If you believe a
dependency vulnerability affects Limner, report it through the same private
channel above.

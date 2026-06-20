// D-RA-22 consent screen — the HTML template. Kept separate from the handler
// logic (consent.ts) so it can be eyeballed and unit-tested in isolation, and
// so the handler stays free of presentation concerns.
//
// A4 constraint: this page is neutral. No Claude / Anthropic branding, logos,
// or product implication. It renders no external assets — the strict CSP set by
// the handler (default-src 'none'; style-src 'unsafe-inline') forbids them — so
// the client's logoUri is deliberately NOT shown, and the client URI is plain
// escaped text, never a live link to an attacker-controlled origin.

/** Escape the five HTML metacharacters for safe interpolation into markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ConsentPageParams {
  /** Resolved client display name, or undefined when the client is unregistered. */
  clientName: string | undefined;
  /** The OAuth client_id (always shown, escaped, as the stable identifier). */
  clientId: string;
  /** The signed CSRF token to embed in the form's hidden field. */
  csrfToken: string;
}

/**
 * Render the consent page. The form posts back to /authorize with the action
 * (approve/deny) and the CSRF token; no JavaScript is required. Every
 * interpolated value is HTML-escaped at the point of insertion.
 */
export function renderConsentPage(params: ConsentPageParams): string {
  const { clientName, clientId, csrfToken } = params;
  const who = clientName
    ? `<strong>${escapeHtml(clientName)}</strong>`
    : `an unregistered application`;
  const idLine = `<code>${escapeHtml(clientId)}</code>`;
  const token = escapeHtml(csrfToken);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize access — Limner MCP</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #0f1115; color: #e6e6e6; }
  .card { width: min(28rem, 92vw); background: #181b22; border: 1px solid #2a2f3a;
    border-radius: 12px; padding: 1.75rem 1.75rem 1.5rem; }
  h1 { font-size: 1.15rem; margin: 0 0 0.75rem; }
  p { line-height: 1.5; margin: 0 0 0.9rem; }
  code { background: #11141a; padding: 0.1rem 0.35rem; border-radius: 5px;
    font-size: 0.85em; word-break: break-all; }
  .scope { background: #11141a; border: 1px solid #2a2f3a; border-radius: 8px;
    padding: 0.75rem 0.9rem; margin: 0 0 1.25rem; }
  .scope strong { display: block; margin-bottom: 0.2rem; }
  .scope span { color: #9aa3b2; font-size: 0.9em; }
  .actions { display: flex; gap: 0.75rem; }
  button { flex: 1; padding: 0.6rem 1rem; font-size: 0.95rem; border-radius: 8px;
    border: 1px solid #2a2f3a; cursor: pointer; }
  .approve { background: #2563eb; border-color: #2563eb; color: #fff; }
  .deny { background: transparent; color: #e6e6e6; }
</style>
</head>
<body>
  <main class="card">
    <h1>Authorize access</h1>
    <p>${who} (${idLine}) is requesting access to the Limner MCP server.</p>
    <div class="scope">
      <strong>mcp</strong>
      <span>Generate and manage images via the Limner MCP tools.</span>
    </div>
    <form method="POST" action="/authorize">
      <input type="hidden" name="csrf_token" value="${token}">
      <div class="actions">
        <button class="approve" type="submit" name="action" value="approve">Approve</button>
        <button class="deny" type="submit" name="action" value="deny">Deny</button>
      </div>
    </form>
  </main>
</body>
</html>`;
}

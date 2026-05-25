// Structured error codes for pipeline failures. The MCP server / CMA tool
// surfaces these as distinct status responses so callers can decide whether
// to retry, prompt for credentials, surface to the user, etc.
export type PipelineErrorCode =
  | 'invalid_input'        // bad prompt / option values; non-retryable
  | 'missing_credential'   // requiredSecrets not satisfied by context.secrets
  | 'unauthorized'         // 401 / 403 from upstream; check credential
  | 'rate_limited'         // 429 from upstream; retry with backoff
  | 'upstream_error'       // upstream returned 4xx/5xx other than the above
  | 'upstream_unavailable' // network failure, timeout, DNS, etc.
  | 'aborted'              // abortSignal fired mid-flight
  | 'unknown';             // last-resort bucket; investigate cause

export class PipelineError extends Error {
  override readonly name = 'PipelineError';

  constructor(
    readonly pipelineId: string,
    readonly code: PipelineErrorCode,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }

  // JSON-serializable shape so the MCP server can include structured error
  // details in tool responses (vs an opaque stack trace).
  toJSON(): {
    name: string;
    pipelineId: string;
    code: PipelineErrorCode;
    message: string;
  } {
    return {
      name: this.name,
      pipelineId: this.pipelineId,
      code: this.code,
      message: this.message,
    };
  }
}

// Helper for the common pre-flight credential check.
export function assertSecrets(
  pipelineId: string,
  required: readonly string[],
  secrets: Readonly<Record<string, string>>,
): void {
  const missing = required.filter((k) => !secrets[k]);
  if (missing.length > 0) {
    throw new PipelineError(
      pipelineId,
      'missing_credential',
      `${pipelineId}: missing required secret(s): ${missing.join(', ')}`,
    );
  }
}

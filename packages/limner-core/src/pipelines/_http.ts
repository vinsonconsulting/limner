// Shared machinery for API-backed pipelines. Underscore prefix marks this
// as internal to the pipelines module; not re-exported from @limner/core.

import { PipelineError, type PipelineErrorCode } from './errors.js';

// Map an upstream HTTP status to a structured pipeline error code. Used by
// every REST-client pipeline (and the Recraft adapter when its MCP
// transport surfaces HTTP errors from the SSE/HTTP channel).
export function mapHttpStatus(status: number): PipelineErrorCode {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'upstream_unavailable';
  if (status >= 400) return 'upstream_error';
  return 'unknown';
}

// Convert a non-OK Response into a PipelineError, attempting to surface the
// upstream body in the message (truncated) for diagnostics. Caller decides
// whether to log the full body.
export async function httpResponseToError(
  pipelineId: string,
  response: Response,
): Promise<PipelineError> {
  const code = mapHttpStatus(response.status);
  // Assigned in both branches below; no dead initializer.
  let body: string;
  try {
    body = (await response.text()).slice(0, 500);
  } catch {
    body = '<unreadable>';
  }
  return new PipelineError(
    pipelineId,
    code,
    `${pipelineId}: upstream returned HTTP ${response.status}${body ? `: ${body}` : ''}`,
  );
}

// Wrap an AbortError caught from fetch in a structured PipelineError.
// Anything that isn't an abort gets re-thrown unchanged so the caller can
// classify it.
export function isAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException && err.name === 'AbortError'
  ) || (
    err instanceof Error && err.name === 'AbortError'
  );
}

// Type-only helper: narrow `unknown` to a record so we can index it safely
// in pipeline response parsers. Lighter than zod for these one-off shapes.
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

// Parse a "WIDTHxHEIGHT" size string into [width, height]. Anything that
// isn't that exact shape — including DALL-E's `size: 'auto'` — yields
// [undefined, undefined], so callers surface width/height as unknown rather
// than guessing. Shared by the DALL-E and Recraft pipelines.
export function parseSize(size: string): [number | undefined, number | undefined] {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return [undefined, undefined];
  return [Number(match[1]), Number(match[2])];
}

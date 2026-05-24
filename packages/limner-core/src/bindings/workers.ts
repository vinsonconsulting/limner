import type { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';

// Bindings shape when running inside a Cloudflare Worker (Path A and Path B
// production deployments). DB is required from Phase 1 onward; BUCKET and
// TOKENS become required when their respective consumers ship.
export type WorkersBindings = {
  kind: 'workers';
  DB: D1Database;
  BUCKET?: R2Bucket;
  TOKENS?: KVNamespace;
};

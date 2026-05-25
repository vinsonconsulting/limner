import type { Bindings } from '../bindings/index.js';
import { isLocal, isWorkers } from '../bindings/index.js';
import { D1MemoryStore } from './d1-store.js';
import { LocalMemoryStore } from './local-store.js';
import type { MemoryStore } from './store.js';

export type { MemoryStore, MemoryRow } from './store.js';
export { memoryFromRow, buildRecallSql } from './store.js';
export { D1MemoryStore } from './d1-store.js';
export { LocalMemoryStore } from './local-store.js';

export function createMemoryStore(bindings: Bindings): MemoryStore {
  if (isWorkers(bindings)) return new D1MemoryStore(bindings.DB);
  if (isLocal(bindings)) return new LocalMemoryStore(bindings.db);
  // Exhaustiveness guard.
  const _exhaustive: never = bindings;
  throw new Error(`createMemoryStore: unknown bindings kind: ${JSON.stringify(_exhaustive)}`);
}

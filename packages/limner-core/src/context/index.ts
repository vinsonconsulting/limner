import type { Bindings } from '../bindings/index.js';
import { isLocal, isWorkers } from '../bindings/index.js';
import type { ProjectStore } from './projects.js';
import { D1ProjectStore, LocalProjectStore } from './projects.js';

export type { ProjectStore } from './projects.js';
export { D1ProjectStore, LocalProjectStore } from './projects.js';

export function createProjectStore(bindings: Bindings): ProjectStore {
  if (isWorkers(bindings)) return new D1ProjectStore(bindings.DB);
  if (isLocal(bindings)) return new LocalProjectStore(bindings.db);
  const _exhaustive: never = bindings;
  throw new Error(`createProjectStore: unknown bindings kind: ${JSON.stringify(_exhaustive)}`);
}

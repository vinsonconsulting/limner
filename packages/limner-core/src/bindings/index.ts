import type { WorkersBindings } from './workers.js';
import type { LocalBindings } from './local.js';

export type { WorkersBindings } from './workers.js';
export type { LocalBindings, LocalBindingsOptions } from './local.js';
export { createLocalBindings } from './local.js';

// Discriminated union threaded through every store. Consumers branch on
// `kind` (or use the type guards below) to dispatch to the right backend.
export type Bindings = WorkersBindings | LocalBindings;

export const isWorkers = (b: Bindings): b is WorkersBindings => b.kind === 'workers';
export const isLocal = (b: Bindings): b is LocalBindings => b.kind === 'local';

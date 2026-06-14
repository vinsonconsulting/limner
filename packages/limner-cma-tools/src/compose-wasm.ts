// Workers-only. Registers the compose WASM provider (static .wasm via
// @limner/mcp's CompiledWasm imports) with @limner/core so the compose
// ops self-init on first use. The consuming Phase-7 Worker calls this
// once at startup AND configures the wrangler CompiledWasm rule (see
// README). Limner is an independent third-party project built on
// Anthropic's CMA platform; this is not an Anthropic product.
//
// Never imported by index.ts or by the Node test tree — pulling
// @limner/mcp/wasm-init's static `.wasm` graph in here keeps the
// node:fs loader (wasm-init-node.ts) out of the consumer's Workers
// bundle. Exposed on the ./compose-wasm subpath only.
import { initComposeWasmWorkers } from '@limner/mcp/wasm-init';

export const initLimnerComposeWasm = initComposeWasmWorkers;

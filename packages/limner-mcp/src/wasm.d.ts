// Wrangler's default CompiledWasm module rule (`**/*.wasm`) turns a
// static .wasm import into a WebAssembly.Module at runtime. This shim
// gives those imports a type; it is only consumed by wasm-init.ts
// (the Workers transport path).
declare module '*.wasm' {
  const mod: WebAssembly.Module;
  export default mod;
}

// WebAssembly SIMD feature detection.
//
// Mensura does not ship a WASM SIMD kernel today. This module exists so a
// caller building deferred kernels can probe whether the host runtime
// supports SIMD before paying the load cost. A list of "still on the TODO"
// kernels is kept in `docs/TODO.md`, not as a runtime constant — leaving it
// in code would invite consumers to import a planning artefact.

export interface WasmSimdFeatureReport {
  readonly supported: boolean;
  readonly checkedBytes: number;
}

// Minimal WASM module that uses the `v128.const` SIMD opcode (`0xfd 0x0c`).
// `WebAssembly.validate` rejects this byte sequence on runtimes that do not
// implement the SIMD proposal, which is exactly the negative we want to
// surface without instantiating any module.
const WASM_SIMD_PROBE = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
  0x03, 0x02, 0x01, 0x00,
  0x0a, 0x16, 0x01, 0x14, 0x00,
  0xfd, 0x0c,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x0b
]);

export function detectWasmSimd(): WasmSimdFeatureReport {
  const wasm = (globalThis as { WebAssembly?: { validate?: (bytes: Uint8Array) => boolean } }).WebAssembly;
  const supported =
    wasm !== undefined &&
    typeof wasm.validate === "function" &&
    wasm.validate(WASM_SIMD_PROBE);

  return {
    supported,
    checkedBytes: WASM_SIMD_PROBE.length
  };
}

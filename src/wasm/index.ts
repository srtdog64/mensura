export interface WasmSimdFeatureReport {
  readonly supported: boolean;
  readonly checkedBytes: number;
}

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

export const WASM_SIMD_DEFERRED_KERNELS = Object.freeze([
  "mat4MultiplyF32Many"
]);

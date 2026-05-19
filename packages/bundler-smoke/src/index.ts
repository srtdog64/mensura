import { mat4TransformAffinePoint3, unwrap, vec3 } from "@exornea/mensura/core";
import { aabb, ray } from "@exornea/mensura/geometry";
import { mat4PerspectiveWebGpuRh } from "@exornea/mensura/gpu";
import { rayAabbHitDistance } from "@exornea/mensura/query";
import { createDeterministicRng, seedFromString } from "@exornea/mensura/validation";
import { detectWasmSimd } from "@exornea/mensura/wasm";

const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 1, 10));
const transformed = mat4TransformAffinePoint3(projection, vec3(0, 0, -1));
const bounds = aabb(vec3(-1, -1, -3), vec3(1, 1, -1));
const hit = rayAabbHitDistance(ray(vec3(0, 0, 0), vec3(0, 0, -1)), bounds);
const rng = createDeterministicRng(seedFromString("mensura:bundler-smoke"));

export const bundlerSmoke = {
  hit,
  transformed,
  draw: rng.nextUint32(),
  wasm: detectWasmSimd()
};

import { mat4TransformAffinePoint3, unwrap, vec3 } from "@exornea/mensura/core";
import { aabb, ray, sphere } from "@exornea/mensura/geometry";
import { mat4PerspectiveWebGpuRh } from "@exornea/mensura/gpu";
import { triangleArea } from "@exornea/mensura/measure";
import { rayAabbHitDistance, rayIntersectsSphere } from "@exornea/mensura/query";
import { createDeterministicRng, seedFromString } from "@exornea/mensura/validation";
import { detectWasmSimd } from "@exornea/mensura/wasm";

const rng = createDeterministicRng(seedFromString("mensura:browser-smoke"), "mulberry32");
const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 0.1, 100));
const transformed = mat4TransformAffinePoint3(projection, vec3(0, 0, -1));
const bounds = aabb(vec3(-1, -1, -3), vec3(1, 1, -1));
const pick = ray(vec3(0, 0, 0), vec3(0, 0, -1));
const target = sphere(vec3(0, 0, -4), 1);

export const browserSmoke = {
  area: triangleArea(vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0)),
  draw: rng.nextUint32(),
  hitAabb: rayAabbHitDistance(pick, bounds),
  hitSphere: rayIntersectsSphere(pick, target),
  transformed,
  wasm: detectWasmSimd()
};

if (typeof globalThis !== "undefined") {
  Object.defineProperty(globalThis, "__mensuraBrowserSmoke", {
    configurable: true,
    value: browserSmoke
  });
}

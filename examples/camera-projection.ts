import {
  mat4LookAtRh,
  mat4Multiply,
  unwrap,
  vec3
} from "@exornea/mensura/core";
import {
  aabb,
  frustumFromMatrixWebGpu,
  frustumIntersectsAabb,
  ray,
  rayAabbHitDistance
} from "@exornea/mensura/geometry";
import { mat4PerspectiveWebGpuRh } from "@exornea/mensura/gpu";

const view = unwrap(
  mat4LookAtRh(vec3(0, 2, 5), vec3(0, 0, 0), vec3(0, 1, 0))
);
const projection = unwrap(
  mat4PerspectiveWebGpuRh(Math.PI / 3, 16 / 9, 0.1, 100)
);
const viewProjection = mat4Multiply(projection, view);

const frustum = frustumFromMatrixWebGpu(viewProjection);

const visibleBounds = aabb(vec3(-1, -1, -1), vec3(1, 1, 1));
const offscreenBounds = aabb(vec3(50, 0, 0), vec3(52, 1, 1));

console.log("visible:", frustumIntersectsAabb(frustum, visibleBounds));
console.log("offscreen:", frustumIntersectsAabb(frustum, offscreenBounds));

const pickRay = ray(vec3(0, 0, 5), vec3(0, 0, -1));
console.log("hit distance:", rayAabbHitDistance(pickRay, visibleBounds));

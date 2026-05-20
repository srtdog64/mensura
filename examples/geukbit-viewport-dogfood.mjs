import { mat4LookAtRh, mat4Multiply, unwrap, vec3 } from "../dist/core/index.js";
import {
  aabb,
  frustumFromMatrixWebGpu,
  frustumIntersectsAabb,
  ray,
  rayAabbHit
} from "../dist/geometry/index.js";
import { mat4PerspectiveWebGpuRh } from "../dist/gpu/index.js";
import { aabbGetBoundingSphere } from "../dist/measure/index.js";

// Geukbit dogfood shape: Mensura owns only geometry math. The host editor owns
// entity ids, selection policy, placement rules, warnings, and undo/redo.

const camera = {
  eye: vec3(0, 2, 6),
  target: vec3(0, 0, 0),
  up: vec3(0, 1, 0),
  aspect: 16 / 9
};

const view = unwrap(mat4LookAtRh(camera.eye, camera.target, camera.up));
const projection = unwrap(mat4PerspectiveWebGpuRh(Math.PI / 3, camera.aspect, 0.1, 100));
const viewProjection = mat4Multiply(projection, view);
const frustum = frustumFromMatrixWebGpu(viewProjection);

const viewportBounds = [
  aabb(vec3(-1, -1, -1), vec3(1, 1, 1)),
  aabb(vec3(3, -0.5, -2), vec3(4, 0.5, -1)),
  aabb(vec3(30, 0, 0), vec3(32, 2, 2))
];

const pickRay = ray(vec3(0, 0, 6), vec3(0, 0, -1));
const visible = [];
let nearest = null;

for (let i = 0; i < viewportBounds.length; i++) {
  const bounds = viewportBounds[i];
  if (frustumIntersectsAabb(frustum, bounds)) {
    visible.push(i);
  }

  const hit = rayAabbHit(pickRay, bounds);
  if (hit && (!nearest || hit.distance < nearest.distance)) {
    nearest = { index: i, distance: hit.distance, point: hit.point };
  }
}

const summary = {
  visible,
  nearest,
  firstBoundsSphere: aabbGetBoundingSphere(viewportBounds[0])
};

console.log(JSON.stringify(summary, null, 2));

assertArrayEqual(visible, [0, 1], "visible bounds");
assertNear(nearest?.distance ?? -1, 5, 1e-12, "nearest distance");
assertNear(summary.firstBoundsSphere.radius, Math.sqrt(3), 1e-12, "bounds sphere radius");

function assertArrayEqual(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label} expected [${expected.join(", ")}], got [${actual.join(", ")}]`);
  }
}

function assertNear(actual, expected, epsilon, label) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

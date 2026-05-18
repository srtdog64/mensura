import {
  QUAT_SLERP_LINEAR_THRESHOLD,
  quat,
  quatConjugate,
  quatFromUnitVectors,
  quatIdentity,
  quatSlerp,
  unwrap,
  vec3
} from "@exornea/mensura/core";

const xToY = unwrap(quatFromUnitVectors(vec3(1, 0, 0), vec3(0, 1, 0)));
console.log("x to y rotation:", xToY);

const xToNegX = unwrap(quatFromUnitVectors(vec3(1, 0, 0), vec3(-1, 0, 0)));
console.log("x to -x rotation (anti-parallel branch):", xToNegX);

console.log("conjugate of x to y:", quatConjugate(xToY));

const identity = quatIdentity();
const tinyRotation = quat(0, 0, 0.001, Math.sqrt(1 - 0.001 ** 2));
const lerped = quatSlerp(identity, tinyRotation, 0.5);
console.log(
  "near-parallel slerp falls back to lerp+normalize at dot >",
  QUAT_SLERP_LINEAR_THRESHOLD
);
console.log("result:", lerped);

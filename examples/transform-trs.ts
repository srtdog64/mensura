import {
  mat4Compose,
  mat4Decompose,
  mat4Scaling,
  mat4TransformPoint3,
  quat,
  vec3
} from "@exornea/mensura/core";

const translation = vec3(1, 2, 3);
const rotation = quat(0, Math.SQRT1_2, 0, Math.SQRT1_2);
const scale = vec3(2, 3, 4);

const transform = mat4Compose(translation, rotation, scale);
console.log("origin to", mat4TransformPoint3(transform, vec3(0, 0, 0)));

const decomposed = mat4Decompose(transform);
console.log("translation:", decomposed.translation);
console.log("scale:", decomposed.scale);
console.log("rotation:", decomposed.rotation);

const mirrored = mat4Scaling(vec3(-1, 1, 1));
console.log("mirrored.scale.x:", mat4Decompose(mirrored).scale.x);

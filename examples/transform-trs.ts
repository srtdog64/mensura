import {
  mat4Scaling,
  mat4TransformPoint3,
  transform3,
  transform3FromMat4,
  transform3FromMat4Checked,
  transform3ToMat4,
  transform3TransformPoint3,
  unwrap,
  quat,
  vec3
} from "@exornea/mensura/core";

const translation = vec3(1, 2, 3);
const rotation = quat(0, Math.SQRT1_2, 0, Math.SQRT1_2);
const scale = vec3(2, 3, 4);

const trs = transform3(translation, rotation, scale);
const transform = transform3ToMat4(trs);
console.log("origin to", mat4TransformPoint3(transform, vec3(0, 0, 0)));
console.log("origin to direct", transform3TransformPoint3(trs, vec3(0, 0, 0)));

const decomposed = transform3FromMat4(transform);
console.log("translation:", decomposed.translation);
console.log("scale:", decomposed.scale);
console.log("rotation:", decomposed.rotation);

const checked = unwrap(transform3FromMat4Checked(transform));
console.log("checked translation:", checked.translation);

const mirrored = mat4Scaling(vec3(-1, 1, 1));
console.log("mirrored.scale.x:", transform3FromMat4(mirrored).scale.x);

import {
  mat4Invert,
  mat4LookAtRh,
  mat4Scaling,
  unwrap,
  vec3
} from "@exornea/mensura/core";
import { mat4PerspectiveWebGpuRh } from "@exornea/mensura/gpu";

// 1. unwrap: fail-fast at the caller's boundary.
const projection = unwrap(
  mat4PerspectiveWebGpuRh(Math.PI / 2, 1, 1, 100),
  "projection setup"
);
console.log("projection ready, first column:", projection.slice(0, 4));

// 2. Discriminated check: handle expected failures inline.
const singular = mat4Scaling(vec3(1, 0, 1));
const inversion = mat4Invert(singular);

if (inversion.ok) {
  console.log("inverse:", inversion.value);
} else {
  console.log(
    "[" + inversion.error.stage + "] " +
    inversion.error.code + ": " + inversion.error.message,
    inversion.error.meta
  );
}

// 3. Error-code switch: route different failure modes.
const degenerate = mat4LookAtRh(vec3(0, 0, 0), vec3(0, 0, 0), vec3(0, 1, 0));

if (!degenerate.ok) {
  switch (degenerate.error.code) {
    case "TRANSFORM_DEGENERATE_BASIS":
      console.log("camera setup rejected: eye == center or up is parallel.");
      break;
    case "TRANSFORM_SINGULAR":
      console.log("singular matrix rejected upstream.");
      break;
    case "VALIDATION_INVALID_FORMAT":
      console.log("argument shape invalid.");
      break;
    default:
      console.log("unhandled error code:", degenerate.error.code);
  }
}

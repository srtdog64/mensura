import type { Obb } from "../geometry/obb.js";
import type { Vec3 } from "../core/vec3.js";
import { vec3, dot3, cross3, sub3, lengthSq3 } from "../core/vec3.js";

function getObbAxes(obb: Obb): [Vec3, Vec3, Vec3] {
  const rot = obb.rotation;
  return [
    vec3(rot[0], rot[1], rot[2]),
    vec3(rot[3], rot[4], rot[5]),
    vec3(rot[6], rot[7], rot[8])
  ];
}

export function testObbObbSat(a: Obb, b: Obb): boolean {
  const aAxes = getObbAxes(a);
  const bAxes = getObbAxes(b);

  const t = sub3(b.center, a.center);

  // 3 axes from A
  for (let i = 0; i < 3; i++) {
    const rA = a.extents.x * Math.abs(dot3(aAxes[i], aAxes[0])) +
               a.extents.y * Math.abs(dot3(aAxes[i], aAxes[1])) +
               a.extents.z * Math.abs(dot3(aAxes[i], aAxes[2]));
    const rB = b.extents.x * Math.abs(dot3(aAxes[i], bAxes[0])) +
               b.extents.y * Math.abs(dot3(aAxes[i], bAxes[1])) +
               b.extents.z * Math.abs(dot3(aAxes[i], bAxes[2]));
    if (Math.abs(dot3(t, aAxes[i])) > rA + rB) return false;
  }

  // 3 axes from B
  for (let i = 0; i < 3; i++) {
    const rA = a.extents.x * Math.abs(dot3(bAxes[i], aAxes[0])) +
               a.extents.y * Math.abs(dot3(bAxes[i], aAxes[1])) +
               a.extents.z * Math.abs(dot3(bAxes[i], aAxes[2]));
    const rB = b.extents.x * Math.abs(dot3(bAxes[i], bAxes[0])) +
               b.extents.y * Math.abs(dot3(bAxes[i], bAxes[1])) +
               b.extents.z * Math.abs(dot3(bAxes[i], bAxes[2]));
    if (Math.abs(dot3(t, bAxes[i])) > rA + rB) return false;
  }

  // 9 cross products
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const axis = cross3(aAxes[i], bAxes[j]);
      if (lengthSq3(axis) < 1e-6) continue;

      const rA = a.extents.x * Math.abs(dot3(axis, aAxes[0])) +
                 a.extents.y * Math.abs(dot3(axis, aAxes[1])) +
                 a.extents.z * Math.abs(dot3(axis, aAxes[2]));
      const rB = b.extents.x * Math.abs(dot3(axis, bAxes[0])) +
                 b.extents.y * Math.abs(dot3(axis, bAxes[1])) +
                 b.extents.z * Math.abs(dot3(axis, bAxes[2]));
      if (Math.abs(dot3(t, axis)) > rA + rB) return false;
    }
  }

  return true;
}

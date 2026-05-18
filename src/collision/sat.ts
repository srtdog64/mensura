import type { Obb } from "../geometry/obb.js";
import type { MutableVec3 } from "../core/vec3.js";
import { dot3, cross3Into, sub3Into, lengthSq3 } from "../core/vec3.js";
import type { CollisionContext } from "./context.js";

function extractObbAxes(obb: Obb, out: MutableVec3[]) {
  const rot = obb.rotation;
  out[0].x = rot[0]; out[0].y = rot[1]; out[0].z = rot[2];
  out[1].x = rot[3]; out[1].y = rot[4]; out[1].z = rot[5];
  out[2].x = rot[6]; out[2].y = rot[7]; out[2].z = rot[8];
}

export function testObbObbSat(a: Obb, b: Obb, ctx: CollisionContext): boolean {
  extractObbAxes(a, ctx.satAAxes);
  extractObbAxes(b, ctx.satBAxes);

  sub3Into(b.center, a.center, ctx.satT);

  // 3 axes from A
  for (let i = 0; i < 3; i++) {
    const rA = a.extents.x * Math.abs(dot3(ctx.satAAxes[i], ctx.satAAxes[0])) +
               a.extents.y * Math.abs(dot3(ctx.satAAxes[i], ctx.satAAxes[1])) +
               a.extents.z * Math.abs(dot3(ctx.satAAxes[i], ctx.satAAxes[2]));
    const rB = b.extents.x * Math.abs(dot3(ctx.satAAxes[i], ctx.satBAxes[0])) +
               b.extents.y * Math.abs(dot3(ctx.satAAxes[i], ctx.satBAxes[1])) +
               b.extents.z * Math.abs(dot3(ctx.satAAxes[i], ctx.satBAxes[2]));
    if (Math.abs(dot3(ctx.satT, ctx.satAAxes[i])) > rA + rB) return false;
  }

  // 3 axes from B
  for (let i = 0; i < 3; i++) {
    const rA = a.extents.x * Math.abs(dot3(ctx.satBAxes[i], ctx.satAAxes[0])) +
               a.extents.y * Math.abs(dot3(ctx.satBAxes[i], ctx.satAAxes[1])) +
               a.extents.z * Math.abs(dot3(ctx.satBAxes[i], ctx.satAAxes[2]));
    const rB = b.extents.x * Math.abs(dot3(ctx.satBAxes[i], ctx.satBAxes[0])) +
               b.extents.y * Math.abs(dot3(ctx.satBAxes[i], ctx.satBAxes[1])) +
               b.extents.z * Math.abs(dot3(ctx.satBAxes[i], ctx.satBAxes[2]));
    if (Math.abs(dot3(ctx.satT, ctx.satBAxes[i])) > rA + rB) return false;
  }

  // 9 cross products
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      cross3Into(ctx.satAAxes[i], ctx.satBAxes[j], ctx.satAxis);
      if (lengthSq3(ctx.satAxis) < 1e-6) continue;

      const rA = a.extents.x * Math.abs(dot3(ctx.satAxis, ctx.satAAxes[0])) +
                 a.extents.y * Math.abs(dot3(ctx.satAxis, ctx.satAAxes[1])) +
                 a.extents.z * Math.abs(dot3(ctx.satAxis, ctx.satAAxes[2]));
      const rB = b.extents.x * Math.abs(dot3(ctx.satAxis, ctx.satBAxes[0])) +
                 b.extents.y * Math.abs(dot3(ctx.satAxis, ctx.satBAxes[1])) +
                 b.extents.z * Math.abs(dot3(ctx.satAxis, ctx.satBAxes[2]));
      if (Math.abs(dot3(ctx.satT, ctx.satAxis)) > rA + rB) return false;
    }
  }

  return true;
}

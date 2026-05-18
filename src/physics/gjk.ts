import type { Vec3 } from "../core/vec3.js";
import { dot3, sub3, add3, scale3, lengthSq3, normalize3, cross3, mutableVec3 } from "../core/vec3.js";
import type { MutableVec3 } from "../core/vec3.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";

export type SupportFunction = (direction: Vec3) => Vec3;

export interface GjkResult {
  intersect: boolean;
  simplex: Vec3[];
}

export function gjk(
  supportA: SupportFunction,
  supportB: SupportFunction,
  maxIterations: number = 64
): Result<GjkResult> {
  const support = (dir: Vec3) => sub3(supportA(dir), supportB(scale3(dir, -1)));

  const initialD = support({ x: 1, y: 0, z: 0 }); // Arbitrary initial direction
  const simplex: Vec3[] = [initialD];

  const d = mutableVec3(-initialD.x, -initialD.y, -initialD.z);

  for (let i = 0; i < maxIterations; i++) {
    const a = support(d);

    if (dot3(a, d) <= 0) {
      return ok({ intersect: false, simplex });
    }

    simplex.push(a);

    if (handleSimplex(simplex, d)) {
      return ok({ intersect: true, simplex });
    }
  }

  return err({
    code: "GJK_MAX_ITERATIONS",
    message: "GJK algorithm exceeded maximum iterations without resolving",
    stage: "GjkIteration",
    retryable: false
  });
}

function handleSimplex(simplex: Vec3[], d: MutableVec3): boolean {
  if (simplex.length === 2) {
    return line(simplex, d);
  } else if (simplex.length === 3) {
    return triangle(simplex, d);
  } else if (simplex.length === 4) {
    return tetrahedron(simplex, d);
  }
  return false;
}

function line(simplex: Vec3[], d: MutableVec3): boolean {
  const a = simplex[1];
  const b = simplex[0];
  const ab = sub3(b, a);
  const ao = scale3(a, -1);

  if (dot3(ab, ao) > 0) {
    const cross1 = cross3(ab, ao);
    const newDir = cross3(cross1, ab);
    if (lengthSq3(newDir) < 1e-6) {
        // origin is on the line
        return true;
    }
    d.x = newDir.x; d.y = newDir.y; d.z = newDir.z;
  } else {
    simplex.pop();
    simplex[0] = a;
    d.x = ao.x; d.y = ao.y; d.z = ao.z;
  }
  return false;
}

function triangle(simplex: Vec3[], d: MutableVec3): boolean {
  const a = simplex[2];
  const b = simplex[1];
  const c = simplex[0];

  const ab = sub3(b, a);
  const ac = sub3(c, a);
  const ao = scale3(a, -1);

  const abc = cross3(ab, ac);

  if (dot3(cross3(abc, ac), ao) > 0) {
    if (dot3(ac, ao) > 0) {
      simplex.shift(); // remove b
      simplex[0] = c;
      simplex[1] = a;
      const newDir = cross3(cross3(ac, ao), ac);
      d.x = newDir.x; d.y = newDir.y; d.z = newDir.z;
    } else {
      return line([b, a], d);
    }
  } else {
    if (dot3(cross3(ab, abc), ao) > 0) {
      return line([b, a], d);
    } else {
      if (dot3(abc, ao) > 0) {
        d.x = abc.x; d.y = abc.y; d.z = abc.z;
      } else {
        simplex[0] = b;
        simplex[1] = c;
        const negAbc = scale3(abc, -1);
        d.x = negAbc.x; d.y = negAbc.y; d.z = negAbc.z;
      }
    }
  }
  return false;
}

function tetrahedron(simplex: Vec3[], d: MutableVec3): boolean {
  const a = simplex[3];
  const b = simplex[2];
  const c = simplex[1];
  const dNode = simplex[0];

  const ab = sub3(b, a);
  const ac = sub3(c, a);
  const ad = sub3(dNode, a);
  const ao = scale3(a, -1);

  const abc = cross3(ab, ac);
  const acd = cross3(ac, ad);
  const adb = cross3(ad, ab);

  if (dot3(abc, ao) > 0) {
    simplex.shift(); // remove dNode
    return triangle(simplex, d);
  }

  if (dot3(acd, ao) > 0) {
    simplex[0] = dNode;
    simplex[1] = c;
    simplex[2] = a;
    simplex.length = 3;
    return triangle(simplex, d);
  }

  if (dot3(adb, ao) > 0) {
    simplex[0] = b;
    simplex[1] = dNode;
    simplex[2] = a;
    simplex.length = 3;
    return triangle(simplex, d);
  }

  return true;
}

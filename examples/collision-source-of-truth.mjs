import { CollisionContext, gjk, mprIntersect } from "../dist/collision/index.js";
import { dot3, lengthSq3, unwrap, vec3 } from "../dist/core/index.js";

// Collision algorithms are intentionally not mirrored into batch/unsafe forms.
// The source of truth is the canonical support-mapped implementation:
//
//   shape data -> supportInto function -> gjk/mprIntersect -> Result
//
// Keep any future broadphase, worker, binary, or visualization layer as an
// adapter that feeds this path. Do not fork GJK/MPR/CCD logic for packed memory.

const ctx = new CollisionContext();

const boxA = boxShape("boxA", vec3(-1, -1, -1), vec3(1, 1, 1));
const boxB = boxShape("boxB", vec3(0.5, -0.5, -0.5), vec3(2, 0.5, 0.5));
const boxC = boxShape("boxC", vec3(3, -0.5, -0.5), vec3(4, 0.5, 0.5));
const sphere = sphereShape("sphere", vec3(0, 0, 0), 0.75);

report("AABB overlap via GJK", unwrap(gjk(boxA.supportInto, boxB.supportInto, ctx)));
report("AABB separated via GJK", unwrap(gjk(boxA.supportInto, boxC.supportInto, ctx)));
report("Box/sphere overlap via MPR", unwrap(mprIntersect(boxA, sphere, ctx)));

// Thin adapters are fine. This adapter prints or asserts the canonical result;
// it does not duplicate collision math.
function report(label, result) {
  console.log(`${label}:`, result.intersect);
}

function boxShape(name, min, max) {
  const center = vec3(
    (min.x + max.x) * 0.5,
    (min.y + max.y) * 0.5,
    (min.z + max.z) * 0.5
  );

  return {
    name,
    center,
    supportInto(direction, out) {
      out.x = direction.x >= 0 ? max.x : min.x;
      out.y = direction.y >= 0 ? max.y : min.y;
      out.z = direction.z >= 0 ? max.z : min.z;
      return out;
    }
  };
}

function sphereShape(name, center, radius) {
  return {
    name,
    center,
    supportInto(direction, out) {
      const lenSq = lengthSq3(direction);
      if (lenSq === 0) {
        out.x = center.x + radius;
        out.y = center.y;
        out.z = center.z;
        return out;
      }
      const scale = radius / Math.sqrt(lenSq);
      out.x = center.x + direction.x * scale;
      out.y = center.y + direction.y * scale;
      out.z = center.z + direction.z * scale;
      return out;
    }
  };
}

// Smoke assertions for CI or reader edits. These check the example contract,
// not a second implementation of collision.
assertGjk(boxA, boxB, true);
assertGjk(boxA, boxC, false);
assertMpr(boxA, sphere, true);

function assertGjk(a, b, expected) {
  const result = unwrap(gjk(a.supportInto, b.supportInto, ctx));
  if (result.intersect !== expected) {
    throw new Error(`${a.name}/${b.name} GJK expected ${expected}, got ${result.intersect}`);
  }
}

function assertMpr(a, b, expected) {
  const result = unwrap(mprIntersect(a, b, ctx));
  if (result.intersect !== expected) {
    throw new Error(`${a.name}/${b.name} MPR expected ${expected}, got ${result.intersect}`);
  }
  if (dot3(result.portalDirection, result.portalDirection) < 0) {
    throw new Error("Unreachable sanity check for portalDirection");
  }
}

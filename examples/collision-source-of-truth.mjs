import { CollisionContext, gjk, mprIntersect } from "../dist/collision/index.js";
import { dot3, lengthSq3, scale3, unwrap, vec3 } from "../dist/core/index.js";

// Collision algorithms are intentionally not mirrored into batch/unsafe forms.
// The source of truth is the canonical support-mapped implementation:
//
//   shape data -> support function -> gjk/mprIntersect -> Result
//
// Keep any future broadphase, worker, binary, or visualization layer as an
// adapter that feeds this path. Do not fork GJK/MPR/CCD logic for packed memory.

const ctx = new CollisionContext();

const boxA = boxShape("boxA", vec3(-1, -1, -1), vec3(1, 1, 1));
const boxB = boxShape("boxB", vec3(0.5, -0.5, -0.5), vec3(2, 0.5, 0.5));
const boxC = boxShape("boxC", vec3(3, -0.5, -0.5), vec3(4, 0.5, 0.5));
const sphere = sphereShape("sphere", vec3(0, 0, 0), 0.75);

report("AABB overlap via GJK", unwrap(gjk(boxA.support, boxB.support, ctx)));
report("AABB separated via GJK", unwrap(gjk(boxA.support, boxC.support, ctx)));
report("Box/sphere overlap via MPR", unwrap(mprIntersect(boxA, sphere, ctx)));

// Thin adapters are fine. This adapter prints or asserts the canonical result;
// it does not duplicate collision math.
function report(label, result) {
  console.log(`${label}:`, result.intersect);
}

function boxShape(name, min, max) {
  const center = scale3(vec3(min.x + max.x, min.y + max.y, min.z + max.z), 0.5);

  return {
    name,
    center,
    support(direction) {
      return vec3(
        direction.x >= 0 ? max.x : min.x,
        direction.y >= 0 ? max.y : min.y,
        direction.z >= 0 ? max.z : min.z
      );
    }
  };
}

function sphereShape(name, center, radius) {
  return {
    name,
    center,
    support(direction) {
      const lenSq = lengthSq3(direction);
      if (lenSq === 0) {
        return vec3(center.x + radius, center.y, center.z);
      }
      return add(center, scale3(direction, radius / Math.sqrt(lenSq)));
    }
  };
}

function add(a, b) {
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}

// Smoke assertions for CI or reader edits. These check the example contract,
// not a second implementation of collision.
assertGjk(boxA, boxB, true);
assertGjk(boxA, boxC, false);
assertMpr(boxA, sphere, true);

function assertGjk(a, b, expected) {
  const result = unwrap(gjk(a.support, b.support, ctx));
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

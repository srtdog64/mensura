import { describe, expect, it } from "vitest";
import { vec3 } from "../src/core/index.js";
import {
  aabb,
  aabbToGridRange,
  capsule,
  capsuleCapsuleContact,
  capsuleCapsuleDistance,
  capsuleCapsuleSignedDistance,
  gridCell,
  gridSpec,
  gridToWorld,
  hashGridCell,
  ray,
  visitGridCellsForAabb,
  worldToGrid
} from "../src/geometry/index.js";
import {
  nearestRayAabbHit,
  overlapManyAabb,
  overlapManyAabbInto,
  raycastManyAabb
} from "../src/query/index.js";
import {
  sweptAabbHit,
  sweptSphereHit
} from "../src/collision/index.js";
import { sphere } from "../src/geometry/index.js";

describe("pure indexed AABB query primitives", () => {
  it("raycasts many AABBs and reports the nearest hit without semantic policy", () => {
    const boxes = [
      aabb(vec3(-1, -1, -6), vec3(1, 1, -4)),
      aabb(vec3(-1, -1, -3), vec3(1, 1, -2)),
      aabb(vec3(4, 4, -6), vec3(5, 5, -4))
    ];
    const hits = raycastManyAabb(ray(vec3(0, 0, 0), vec3(0, 0, -1)), boxes);
    const nearest = nearestRayAabbHit(ray(vec3(0, 0, 0), vec3(0, 0, -1)), boxes);

    expect(hits.map((hit) => hit.index)).toEqual([0, 1]);
    expect(hits.map((hit) => hit.distance)).toEqual([4, 2]);
    expect(nearest?.index).toBe(1);
    expect(nearest?.distance).toBe(2);
    expect(nearest?.point).toEqual(vec3(0, 0, -2));
  });

  it("emits canonical overlap pairs for many AABBs", () => {
    const boxes = [
      aabb(vec3(0, 0, 0), vec3(2, 2, 2)),
      aabb(vec3(1, 1, 1), vec3(3, 3, 3)),
      aabb(vec3(4, 4, 4), vec3(5, 5, 5)),
      aabb(vec3(2, 2, 2), vec3(4, 4, 4))
    ];
    const out: { a: number; b: number }[] = [{ a: 99, b: 100 }];

    expect(overlapManyAabbInto(boxes, out)).toBe(out);
    expect(out).toEqual([{ a: 0, b: 1 }, { a: 0, b: 3 }, { a: 1, b: 3 }, { a: 2, b: 3 }]);
    expect(overlapManyAabb(boxes, 2)).toEqual([{ a: 0, b: 1 }]);
  });
});

describe("grid primitives", () => {
  it("maps world points and AABBs into stable grid cells", () => {
    const grid = gridSpec(vec3(0, 0, 0), 1);
    const range = aabbToGridRange(aabb(vec3(0, 0, 0), vec3(2, 1, 1)), grid);
    const cells: string[] = [];

    visitGridCellsForAabb(aabb(vec3(0, 0, 0), vec3(2, 1, 1)), grid, (cell) => {
      cells.push(hashGridCell(cell));
    });

    expect(worldToGrid(vec3(-0.1, 0, 1.9), grid)).toEqual(gridCell(-1, 0, 1));
    expect(gridToWorld(gridCell(2, 3, 4), grid)).toEqual(vec3(2, 3, 4));
    expect(range.min).toEqual(gridCell(0, 0, 0));
    expect(range.max).toEqual(gridCell(1, 0, 0));
    expect(cells).toEqual(["0,0,0", "1,0,0"]);
  });
});

describe("capsule-capsule measurements", () => {
  it("reports signed distance and contact data between capsule surfaces", () => {
    const a = capsule(vec3(0, 0, 0), vec3(0, 0, 2), 0.5);
    const b = capsule(vec3(2, 0, 0), vec3(2, 0, 2), 0.25);
    const overlapping = capsule(vec3(0.75, 0, 0), vec3(0.75, 0, 2), 0.5);
    const contact = capsuleCapsuleContact(a, b);

    expect(capsuleCapsuleDistance(a, b)).toBeCloseTo(1.25, 12);
    expect(capsuleCapsuleSignedDistance(a, b)).toBeCloseTo(1.25, 12);
    expect(capsuleCapsuleSignedDistance(a, overlapping)).toBeCloseTo(-0.25, 12);
    expect(contact?.intersects).toBe(false);
    expect(contact?.normal).toEqual(vec3(1, 0, 0));
    expect(contact?.point0).toEqual(vec3(0.5, 0, 0));
    expect(contact?.point1).toEqual(vec3(1.75, 0, 0));
  });
});

describe("rich sweep hit results", () => {
  it("adds point, remaining motion, and overlap metadata to AABB and sphere sweeps", () => {
    const aabbHit = sweptAabbHit(
      aabb(vec3(0, 0, 0), vec3(1, 1, 1)),
      vec3(4, 0, 0),
      aabb(vec3(3, 0, 0), vec3(4, 1, 1))
    );
    const sphereHit = sweptSphereHit(
      sphere(vec3(0, 0, 0), 1),
      vec3(10, 0, 0),
      sphere(vec3(5, 0, 0), 1)
    );
    const overlappingSphereHit = sweptSphereHit(
      sphere(vec3(0, 0, 0), 1),
      vec3(1, 0, 0),
      sphere(vec3(1, 0, 0), 1)
    );

    expect(aabbHit?.time).toBeCloseTo(0.5, 12);
    expect(aabbHit?.point).toEqual(vec3(3, 0.5, 0.5));
    expect(aabbHit?.remainingMotion).toEqual(vec3(2, 0, 0));
    expect(aabbHit?.startedOverlapping).toBe(false);

    expect(sphereHit?.time).toBeCloseTo(0.3, 12);
    expect(sphereHit?.point).toEqual(vec3(4, 0, 0));
    expect(sphereHit?.remainingMotion).toEqual(vec3(7, 0, 0));
    expect(sphereHit?.startedOverlapping).toBe(false);

    expect(overlappingSphereHit?.time).toBe(0);
    expect(overlappingSphereHit?.startedOverlapping).toBe(true);
  });
});

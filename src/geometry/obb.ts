import type { Vec3, MutableVec3 } from "../core/vec3.js";
import { vec3, copy3, copy3Into, mutableVec3 } from "../core/vec3.js";
import type { Mat3, MutableMat3 } from "../core/mat3.js";
import { mat3Identity, mat3Copy, mat3CopyInto } from "../core/mat3.js";
import type { MutableAabb } from "./aabb.js";
import { mutableAabb } from "./aabb.js";

export interface Obb {
  readonly center: Vec3;
  readonly extents: Vec3; // half sizes along the local axes
  readonly rotation: Mat3; // orientation matrix
}

export interface MutableObb {
  center: MutableVec3;
  extents: MutableVec3;
  rotation: MutableMat3;
}

export function obb(center: Vec3, extents: Vec3, rotation: Mat3): Obb {
  return {
    center: copy3(center),
    extents: copy3(extents),
    rotation: mat3Copy(rotation)
  };
}

export function mutableObb(center?: Vec3, extents?: Vec3, rotation?: Mat3): MutableObb {
  return {
    center: center ? copy3(center) : vec3(0, 0, 0),
    extents: extents ? copy3(extents) : vec3(1, 1, 1),
    rotation: rotation ? mat3Copy(rotation) : mat3Identity()
  };
}

export function copyObb(value: Obb): Obb {
  return obb(value.center, value.extents, value.rotation);
}

export function copyObbInto(value: Obb, out: MutableObb): MutableObb {
  copy3Into(value.center, out.center);
  copy3Into(value.extents, out.extents);
  mat3CopyInto(value.rotation, out.rotation);
  return out;
}

/**
 * Project `point` into the OBB's local frame and test against the half-extents.
 * Rotation is column-major: column `i` is the world-space direction of the
 * local `i` axis, so `localPᵢ = rotation_column_i · (point - center)`.
 */
export function obbContainsPoint(value: Obb, point: Vec3): boolean {
  const dx = point.x - value.center.x;
  const dy = point.y - value.center.y;
  const dz = point.z - value.center.z;
  const r = value.rotation;
  const lx = r[0] * dx + r[1] * dy + r[2] * dz;
  const ly = r[3] * dx + r[4] * dy + r[5] * dz;
  const lz = r[6] * dx + r[7] * dy + r[8] * dz;
  return (
    Math.abs(lx) <= value.extents.x &&
    Math.abs(ly) <= value.extents.y &&
    Math.abs(lz) <= value.extents.z
  );
}

/**
 * Closest point on the OBB to `point`. Transforms into the OBB's local frame,
 * clamps to `[-extents, +extents]`, then transforms back into world space.
 */
export function obbClosestPoint(value: Obb, point: Vec3): MutableVec3 {
  return obbClosestPointInto(value, point, mutableVec3());
}

export function obbClosestPointInto(value: Obb, point: Vec3, out: MutableVec3): MutableVec3 {
  const dx = point.x - value.center.x;
  const dy = point.y - value.center.y;
  const dz = point.z - value.center.z;
  const r = value.rotation;
  // local = R^T (p - c). With column-major storage, R^T row i is column i = (r[3i+0], r[3i+1], r[3i+2]).
  let lx = r[0] * dx + r[1] * dy + r[2] * dz;
  let ly = r[3] * dx + r[4] * dy + r[5] * dz;
  let lz = r[6] * dx + r[7] * dy + r[8] * dz;
  const ex = value.extents.x;
  const ey = value.extents.y;
  const ez = value.extents.z;
  if (lx < -ex) lx = -ex;
  else if (lx > ex) lx = ex;
  if (ly < -ey) ly = -ey;
  else if (ly > ey) ly = ey;
  if (lz < -ez) lz = -ez;
  else if (lz > ez) lz = ez;
  // world = c + R · local. Column 0 = r[0..2], column 1 = r[3..5], column 2 = r[6..8].
  out.x = value.center.x + r[0] * lx + r[3] * ly + r[6] * lz;
  out.y = value.center.y + r[1] * lx + r[4] * ly + r[7] * lz;
  out.z = value.center.z + r[2] * lx + r[5] * ly + r[8] * lz;
  return out;
}

/**
 * World-space AABB that contains the OBB. The half-extent along world axis `i`
 * is `|R_i0| · ex + |R_i1| · ey + |R_i2| · ez` where `R_ij` is the world
 * `i` component of local axis `j`. This is the standard separating-axis
 * projection of the OBB onto each world axis.
 */
export function obbGetAabb(value: Obb): MutableAabb {
  return obbGetAabbInto(value, mutableAabb());
}

export function obbGetAabbInto(value: Obb, out: MutableAabb): MutableAabb {
  const r = value.rotation;
  const ex = value.extents.x;
  const ey = value.extents.y;
  const ez = value.extents.z;
  // World-axis half extent. r is column-major: rotation column j = (r[3j+0], r[3j+1], r[3j+2]).
  // World component i of local axis j is r[3j + i]; so half-extent on world axis i is
  // |r[0+i]|·ex + |r[3+i]|·ey + |r[6+i]|·ez.
  const hx = Math.abs(r[0]) * ex + Math.abs(r[3]) * ey + Math.abs(r[6]) * ez;
  const hy = Math.abs(r[1]) * ex + Math.abs(r[4]) * ey + Math.abs(r[7]) * ez;
  const hz = Math.abs(r[2]) * ex + Math.abs(r[5]) * ey + Math.abs(r[8]) * ez;
  out.min.x = value.center.x - hx;
  out.min.y = value.center.y - hy;
  out.min.z = value.center.z - hz;
  out.max.x = value.center.x + hx;
  out.max.y = value.center.y + hy;
  out.max.z = value.center.z + hz;
  return out;
}

/**
 * Write the eight world-space corners of the OBB into `out`, in the order
 * `(-ex, -ey, -ez)`, `(+ex, -ey, -ez)`, `(-ex, +ey, -ez)`, `(+ex, +ey, -ez)`,
 * then the four `+ez` corners. The caller owns the array slots.
 */
export function obbGetCorners(value: Obb): MutableVec3[] {
  const corners: MutableVec3[] = [
    mutableVec3(), mutableVec3(), mutableVec3(), mutableVec3(),
    mutableVec3(), mutableVec3(), mutableVec3(), mutableVec3()
  ];
  return obbGetCornersInto(value, corners);
}

export function obbGetCornersInto(value: Obb, out: MutableVec3[]): MutableVec3[] {
  const r = value.rotation;
  const ex = value.extents.x;
  const ey = value.extents.y;
  const ez = value.extents.z;
  const cx = value.center.x;
  const cy = value.center.y;
  const cz = value.center.z;
  // Local x-axis world contribution (per ±ex).
  const xX = r[0] * ex;
  const xY = r[1] * ex;
  const xZ = r[2] * ex;
  // Local y-axis world contribution (per ±ey).
  const yX = r[3] * ey;
  const yY = r[4] * ey;
  const yZ = r[5] * ey;
  // Local z-axis world contribution (per ±ez).
  const zX = r[6] * ez;
  const zY = r[7] * ez;
  const zZ = r[8] * ez;
  let i = 0;
  for (let sz = -1; sz <= 1; sz += 2) {
    for (let sy = -1; sy <= 1; sy += 2) {
      for (let sx = -1; sx <= 1; sx += 2) {
        const corner = out[i++];
        corner.x = cx + sx * xX + sy * yX + sz * zX;
        corner.y = cy + sx * xY + sy * yY + sz * zY;
        corner.z = cz + sx * xZ + sy * yZ + sz * zZ;
      }
    }
  }
  return out;
}

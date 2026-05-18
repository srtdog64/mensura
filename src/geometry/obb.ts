import type { Vec3, MutableVec3 } from "../core/vec3.js";
import { vec3, copy3, copy3Into } from "../core/vec3.js";
import type { Mat3, MutableMat3 } from "../core/mat3.js";
import { mat3Identity, mat3Copy, mat3CopyInto } from "../core/mat3.js";

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

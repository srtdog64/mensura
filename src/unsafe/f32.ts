import type { Mat4Like, MutableMat4 } from "../core/mat4.js";
import { mat4Identity } from "../core/mat4.js";
import type { MutableVec3, Vec3 } from "../core/vec3.js";
import { mutableVec3 } from "../core/vec3.js";

export const F32_BYTES = 4;
export const WGSL_VEC3F_SIZE_BYTES = 12;
export const WGSL_VEC3F_ALIGN_BYTES = 16;
export const WGSL_MAT4X4F_SIZE_BYTES = 64;
export const MAT4_F32_LENGTH = 16;

export function unsafeVec3ReadFloat32(buffer: ArrayLike<number>, offset: number = 0): Vec3 {
  return unsafeVec3ReadFloat32Into(buffer, offset, mutableVec3());
}

export function unsafeVec3ReadFloat32Into(
  buffer: ArrayLike<number>,
  offset: number,
  out: MutableVec3
): MutableVec3 {
  out.x = buffer[offset + 0];
  out.y = buffer[offset + 1];
  out.z = buffer[offset + 2];
  return out;
}

export function unsafeVec3WriteFloat32(value: Vec3, buffer: Float32Array, offset: number = 0): Float32Array {
  buffer[offset + 0] = value.x;
  buffer[offset + 1] = value.y;
  buffer[offset + 2] = value.z;
  return buffer;
}

export function unsafeVec3WriteFloat32x4(
  value: Vec3,
  buffer: Float32Array,
  offset: number = 0,
  w: number = 0
): Float32Array {
  buffer[offset + 0] = value.x;
  buffer[offset + 1] = value.y;
  buffer[offset + 2] = value.z;
  buffer[offset + 3] = w;
  return buffer;
}

export function unsafeVec3ReadDataViewF32(
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): Vec3 {
  return unsafeVec3ReadDataViewF32Into(view, byteOffset, mutableVec3(), littleEndian);
}

export function unsafeVec3ReadDataViewF32Into(
  view: DataView,
  byteOffset: number,
  out: MutableVec3,
  littleEndian: boolean = true
): MutableVec3 {
  out.x = view.getFloat32(byteOffset + 0, littleEndian);
  out.y = view.getFloat32(byteOffset + 4, littleEndian);
  out.z = view.getFloat32(byteOffset + 8, littleEndian);
  return out;
}

export function unsafeVec3WriteDataViewF32(
  value: Vec3,
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): DataView {
  view.setFloat32(byteOffset + 0, value.x, littleEndian);
  view.setFloat32(byteOffset + 4, value.y, littleEndian);
  view.setFloat32(byteOffset + 8, value.z, littleEndian);
  return view;
}

export function unsafeWgslVec3WriteDataViewF32(
  value: Vec3,
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): DataView {
  unsafeVec3WriteDataViewF32(value, view, byteOffset, littleEndian);
  view.setFloat32(byteOffset + WGSL_VEC3F_SIZE_BYTES, 0, littleEndian);
  return view;
}

export function unsafeMat4ReadFloat32(buffer: ArrayLike<number>, offset: number = 0): MutableMat4 {
  return unsafeMat4ReadFloat32Into(buffer, offset, mat4Identity());
}

export function unsafeMat4ReadFloat32Into(
  buffer: ArrayLike<number>,
  offset: number,
  out: MutableMat4
): MutableMat4 {
  for (let index = 0; index < MAT4_F32_LENGTH; index += 1) {
    out[index] = buffer[offset + index];
  }

  return out;
}

export function unsafeMat4WriteFloat32(value: Mat4Like, buffer: Float32Array, offset: number = 0): Float32Array {
  for (let index = 0; index < MAT4_F32_LENGTH; index += 1) {
    buffer[offset + index] = value[index];
  }

  return buffer;
}

export function unsafeMat4ReadDataViewF32(
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): MutableMat4 {
  return unsafeMat4ReadDataViewF32Into(view, byteOffset, mat4Identity(), littleEndian);
}

export function unsafeMat4ReadDataViewF32Into(
  view: DataView,
  byteOffset: number,
  out: MutableMat4,
  littleEndian: boolean = true
): MutableMat4 {
  for (let index = 0; index < MAT4_F32_LENGTH; index += 1) {
    out[index] = view.getFloat32(byteOffset + index * F32_BYTES, littleEndian);
  }

  return out;
}

export function unsafeMat4WriteDataViewF32(
  value: Mat4Like,
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): DataView {
  for (let index = 0; index < MAT4_F32_LENGTH; index += 1) {
    view.setFloat32(byteOffset + index * F32_BYTES, value[index], littleEndian);
  }

  return view;
}

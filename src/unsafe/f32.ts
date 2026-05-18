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
  out[0] = buffer[offset + 0];
  out[1] = buffer[offset + 1];
  out[2] = buffer[offset + 2];
  out[3] = buffer[offset + 3];
  out[4] = buffer[offset + 4];
  out[5] = buffer[offset + 5];
  out[6] = buffer[offset + 6];
  out[7] = buffer[offset + 7];
  out[8] = buffer[offset + 8];
  out[9] = buffer[offset + 9];
  out[10] = buffer[offset + 10];
  out[11] = buffer[offset + 11];
  out[12] = buffer[offset + 12];
  out[13] = buffer[offset + 13];
  out[14] = buffer[offset + 14];
  out[15] = buffer[offset + 15];
  return out;
}

export function unsafeMat4WriteFloat32(value: Mat4Like, buffer: Float32Array, offset: number = 0): Float32Array {
  buffer[offset + 0] = value[0];
  buffer[offset + 1] = value[1];
  buffer[offset + 2] = value[2];
  buffer[offset + 3] = value[3];
  buffer[offset + 4] = value[4];
  buffer[offset + 5] = value[5];
  buffer[offset + 6] = value[6];
  buffer[offset + 7] = value[7];
  buffer[offset + 8] = value[8];
  buffer[offset + 9] = value[9];
  buffer[offset + 10] = value[10];
  buffer[offset + 11] = value[11];
  buffer[offset + 12] = value[12];
  buffer[offset + 13] = value[13];
  buffer[offset + 14] = value[14];
  buffer[offset + 15] = value[15];
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
  out[0] = view.getFloat32(byteOffset + 0, littleEndian);
  out[1] = view.getFloat32(byteOffset + 4, littleEndian);
  out[2] = view.getFloat32(byteOffset + 8, littleEndian);
  out[3] = view.getFloat32(byteOffset + 12, littleEndian);
  out[4] = view.getFloat32(byteOffset + 16, littleEndian);
  out[5] = view.getFloat32(byteOffset + 20, littleEndian);
  out[6] = view.getFloat32(byteOffset + 24, littleEndian);
  out[7] = view.getFloat32(byteOffset + 28, littleEndian);
  out[8] = view.getFloat32(byteOffset + 32, littleEndian);
  out[9] = view.getFloat32(byteOffset + 36, littleEndian);
  out[10] = view.getFloat32(byteOffset + 40, littleEndian);
  out[11] = view.getFloat32(byteOffset + 44, littleEndian);
  out[12] = view.getFloat32(byteOffset + 48, littleEndian);
  out[13] = view.getFloat32(byteOffset + 52, littleEndian);
  out[14] = view.getFloat32(byteOffset + 56, littleEndian);
  out[15] = view.getFloat32(byteOffset + 60, littleEndian);
  return out;
}

export function unsafeMat4WriteDataViewF32(
  value: Mat4Like,
  view: DataView,
  byteOffset: number,
  littleEndian: boolean = true
): DataView {
  view.setFloat32(byteOffset + 0, value[0], littleEndian);
  view.setFloat32(byteOffset + 4, value[1], littleEndian);
  view.setFloat32(byteOffset + 8, value[2], littleEndian);
  view.setFloat32(byteOffset + 12, value[3], littleEndian);
  view.setFloat32(byteOffset + 16, value[4], littleEndian);
  view.setFloat32(byteOffset + 20, value[5], littleEndian);
  view.setFloat32(byteOffset + 24, value[6], littleEndian);
  view.setFloat32(byteOffset + 28, value[7], littleEndian);
  view.setFloat32(byteOffset + 32, value[8], littleEndian);
  view.setFloat32(byteOffset + 36, value[9], littleEndian);
  view.setFloat32(byteOffset + 40, value[10], littleEndian);
  view.setFloat32(byteOffset + 44, value[11], littleEndian);
  view.setFloat32(byteOffset + 48, value[12], littleEndian);
  view.setFloat32(byteOffset + 52, value[13], littleEndian);
  view.setFloat32(byteOffset + 56, value[14], littleEndian);
  view.setFloat32(byteOffset + 60, value[15], littleEndian);
  return view;
}

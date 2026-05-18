import type { Mat4Like, MutableMat4 } from "../core/mat4.js";
import type { Vec3 } from "../core/vec3.js";

export function vec3WriteFloat32(value: Vec3, buffer: Float32Array, offset: number = 0): Float32Array {
  buffer[offset + 0] = value.x;
  buffer[offset + 1] = value.y;
  buffer[offset + 2] = value.z;
  return buffer;
}

export function vec3WriteFloat32x4(
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

export function vec3ReadFloat32(buffer: ArrayLike<number>, offset: number = 0): Vec3 {
  return {
    x: buffer[offset + 0],
    y: buffer[offset + 1],
    z: buffer[offset + 2]
  };
}

export function mat4WriteFloat32(value: Mat4Like, buffer: Float32Array, offset: number = 0): Float32Array {
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

export function mat4ReadFloat32(buffer: ArrayLike<number>, offset: number = 0): MutableMat4 {
  return [
    buffer[offset + 0], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3],
    buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7],
    buffer[offset + 8], buffer[offset + 9], buffer[offset + 10], buffer[offset + 11],
    buffer[offset + 12], buffer[offset + 13], buffer[offset + 14], buffer[offset + 15]
  ];
}
